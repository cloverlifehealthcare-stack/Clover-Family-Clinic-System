const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

const VALID_SOURCE_TYPES = ['animal_bite', 'consultation', 'manual'];
const VALID_DISCOUNT_TYPES = ['none', 'pwd', 'senior'];
const DISCOUNT_RATE = 0.2; // 20% PWD/Senior discount, RA 9994 / RA 10754 — see docs §6/§0

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function getStatement(id) {
  const statement = await db('billing_statements').where({ id }).first();
  if (!statement) {
    throw new ApiError(404, 'Billing statement not found.');
  }

  const [items, payments] = await Promise.all([
    db('billing_items').where({ billing_statement_id: id }),
    db('payments').where({ billing_statement_id: id }).orderBy('paid_at'),
  ]);

  const amountPaid = payments.filter((p) => p.status === 'active').reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const balanceDue = round2(Number(statement.total_amount) - amountPaid);

  return { ...statement, items, payments, amountPaid: round2(amountPaid), balanceDue };
}

async function listStatementsForPatient(patientId) {
  return db('billing_statements').where({ patient_id: patientId }).orderBy('created_at', 'desc');
}

async function createStatement(input) {
  const { patientId, sourceType, sourceId, items, discountType, discountIdNumber, discountHolderName, createdBy, ipAddress } = input;

  if (!VALID_SOURCE_TYPES.includes(sourceType)) {
    throw new ApiError(400, `sourceType must be one of: ${VALID_SOURCE_TYPES.join(', ')}`);
  }
  const effectiveDiscountType = discountType || 'none';
  if (!VALID_DISCOUNT_TYPES.includes(effectiveDiscountType)) {
    throw new ApiError(400, `discountType must be one of: ${VALID_DISCOUNT_TYPES.join(', ')}`);
  }
  if (effectiveDiscountType !== 'none' && (!discountIdNumber || !discountHolderName)) {
    throw new ApiError(400, 'discountIdNumber and discountHolderName are required when a PWD/Senior discount is applied.');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'items (a non-empty array of charges) is required.');
  }

  const patient = await db('patients').where({ id: patientId }).first();
  if (!patient) {
    throw new ApiError(404, 'Patient not found.');
  }

  const preparedItems = items.map((item) => {
    if (!item.description || item.unitPrice === undefined || item.unitPrice === null) {
      throw new ApiError(400, 'Each item requires description and unitPrice.');
    }
    // Coerced and checked with Number.isFinite rather than trusted as-is: non-numeric input
    // (e.g. a typo'd string) would otherwise flow through as NaN all the way to a Postgres
    // insert on a decimal column, surfacing as an opaque 500 instead of a clean 400 here.
    const quantity = Number(item.quantity === undefined ? 1 : item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
      throw new ApiError(400, 'quantity and unitPrice must be numbers.');
    }
    if (quantity <= 0 || unitPrice < 0) {
      throw new ApiError(400, 'quantity must be positive and unitPrice cannot be negative.');
    }
    return {
      service_id: item.serviceId || null,
      description: item.description,
      quantity,
      unit_price: unitPrice,
      is_discount_eligible: item.isDiscountEligible !== false,
      amount: round2(quantity * unitPrice),
    };
  });

  const subtotalAmount = round2(preparedItems.reduce((sum, i) => sum + i.amount, 0));
  const eligibleSubtotal = round2(preparedItems.filter((i) => i.is_discount_eligible).reduce((sum, i) => sum + i.amount, 0));
  const discountAmount = effectiveDiscountType !== 'none' ? round2(eligibleSubtotal * DISCOUNT_RATE) : 0;
  const totalAmount = round2(subtotalAmount - discountAmount);

  const [created] = await db('billing_statements')
    .insert({
      patient_id: patientId,
      source_type: sourceType,
      source_id: sourceId || null,
      subtotal_amount: subtotalAmount,
      discount_type: effectiveDiscountType,
      discount_id_number: effectiveDiscountType !== 'none' ? discountIdNumber : null,
      discount_holder_name: effectiveDiscountType !== 'none' ? discountHolderName : null,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      created_by: createdBy,
    })
    .returning(['id']);

  await db('billing_items').insert(preparedItems.map((item) => ({ ...item, billing_statement_id: created.id })));

  await auditLog.write({
    userId: createdBy,
    action: 'billing.statement_create',
    entityType: 'billing_statement',
    entityId: created.id,
    newValue: { patientId, subtotalAmount, discountAmount, totalAmount },
    ipAddress,
  });

  return getStatement(created.id);
}

async function recordPayment(statementId, input) {
  // Coerced to Number up front, not just validated: `statement.amountPaid + amountPaid`
  // below uses `+`, which does string concatenation (not addition) if either side is a
  // string. amountPaid arrives as JSON from an HTTP body — nothing guarantees it's a JS
  // number rather than "390.00" — and `*`/`-`/comparisons all coerce safely, so this was
  // the one spot that needed an explicit conversion. Silently produced NaN in production
  // before this fix, live-smoke-tested with a string amount.
  const amountPaid = Number(input.amountPaid);
  const { paymentMethod, orNumber, receivedBy, ipAddress } = input;

  const statement = await getStatement(statementId);
  if (statement.status === 'void') {
    throw new ApiError(400, 'Cannot record a payment against a voided statement.');
  }
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    throw new ApiError(400, 'amountPaid must be a positive number.');
  }
  if (!paymentMethod || !orNumber) {
    throw new ApiError(400, 'paymentMethod and orNumber are required.');
  }
  if (amountPaid > statement.balanceDue) {
    throw new ApiError(400, `amountPaid (${amountPaid}) exceeds the remaining balance due (${statement.balanceDue}).`);
  }

  await db('payments').insert({
    billing_statement_id: statementId,
    amount_paid: amountPaid,
    payment_method: paymentMethod,
    or_number: orNumber,
    received_by: receivedBy,
  });

  const newAmountPaid = round2(statement.amountPaid + amountPaid);
  const newStatus = newAmountPaid >= Number(statement.total_amount) ? 'paid' : 'partially_paid';
  await db('billing_statements').where({ id: statementId }).update({ status: newStatus });

  await auditLog.write({
    userId: receivedBy,
    action: 'payment.process',
    entityType: 'billing_statement',
    entityId: statementId,
    newValue: { amountPaid, paymentMethod, orNumber },
    ipAddress,
  });

  return getStatement(statementId);
}

async function voidStatement(statementId, { reason, actingUserId, ipAddress }) {
  const statement = await getStatement(statementId);
  if (statement.status === 'void') {
    throw new ApiError(400, 'This statement has already been voided.');
  }
  if (!reason) {
    throw new ApiError(400, 'reason is required to void a statement.');
  }
  const hasActivePayments = statement.payments.some((p) => p.status === 'active');
  if (hasActivePayments) {
    throw new ApiError(400, 'Void all active payments on this statement first, then void the statement.');
  }

  await db('billing_statements').where({ id: statementId }).update({
    status: 'void',
    voided_by: actingUserId,
    void_reason: reason,
    voided_at: db.fn.now(),
  });

  await auditLog.write({
    userId: actingUserId,
    action: 'billing.statement_void',
    entityType: 'billing_statement',
    entityId: statementId,
    newValue: { reason },
    ipAddress,
  });

  return getStatement(statementId);
}

async function voidPayment(paymentId, { reason, actingUserId, ipAddress }) {
  const payment = await db('payments').where({ id: paymentId }).first();
  if (!payment) {
    throw new ApiError(404, 'Payment not found.');
  }
  if (payment.status === 'voided') {
    throw new ApiError(400, 'This payment has already been voided.');
  }
  if (!reason) {
    throw new ApiError(400, 'reason is required to void a payment.');
  }

  await db('payments').where({ id: paymentId }).update({
    status: 'voided',
    void_reason: reason,
    voided_by: actingUserId,
    voided_at: db.fn.now(),
  });

  const statement = await getStatement(payment.billing_statement_id);
  let newStatus = 'partially_paid';
  if (statement.amountPaid <= 0) {
    newStatus = 'unpaid';
  } else if (statement.amountPaid >= Number(statement.total_amount)) {
    newStatus = 'paid';
  }
  await db('billing_statements').where({ id: payment.billing_statement_id }).update({ status: newStatus });

  await auditLog.write({
    userId: actingUserId,
    action: 'payment.void',
    entityType: 'billing_statement',
    entityId: payment.billing_statement_id,
    newValue: { paymentId, reason },
    ipAddress,
  });

  return getStatement(payment.billing_statement_id);
}

module.exports = { createStatement, getStatement, listStatementsForPatient, recordPayment, voidStatement, voidPayment };
