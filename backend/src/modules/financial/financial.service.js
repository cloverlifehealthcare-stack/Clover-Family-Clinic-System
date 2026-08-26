const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

const EXPENSE_CATEGORIES = ['supplies', 'utilities', 'rent', 'salaries', 'equipment', 'maintenance', 'other'];
const VACCINE_COST_CATEGORIES = ['vaccine', 'rig'];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function requireDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new ApiError(400, 'startDate and endDate are required (YYYY-MM-DD).');
  }
  if (startDate > endDate) {
    throw new ApiError(400, 'startDate must not be after endDate.');
  }
}

async function createExpense({ expenseDate, category, description, amount, paidTo, recordedBy, ipAddress }) {
  if (!expenseDate || !category || !description) {
    throw new ApiError(400, 'expenseDate, category, and description are required.');
  }
  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw new ApiError(400, `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`);
  }
  // Coerced/checked with Number.isFinite, not trusted as-is — the same JSON-body-arrives-as-
  // string risk billing.service.recordPayment hit with amountPaid.
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ApiError(400, 'amount must be a positive number.');
  }

  const [created] = await db('expenses')
    .insert({
      expense_date: expenseDate,
      category,
      description,
      amount: round2(numericAmount),
      paid_to: paidTo || null,
      recorded_by: recordedBy,
    })
    .returning(['id']);

  await auditLog.write({
    userId: recordedBy,
    action: 'financial.expense_create',
    entityType: 'expense',
    entityId: created.id,
    newValue: { expenseDate, category, amount: numericAmount },
    ipAddress,
  });

  return db('expenses').where({ id: created.id }).first();
}

async function voidExpense(id, { reason, actingUserId, ipAddress }) {
  const expense = await db('expenses').where({ id }).first();
  if (!expense) {
    throw new ApiError(404, 'Expense not found.');
  }
  if (expense.status === 'voided') {
    throw new ApiError(400, 'This expense has already been voided.');
  }
  if (!reason) {
    throw new ApiError(400, 'reason is required to void an expense.');
  }

  await db('expenses').where({ id }).update({
    status: 'voided',
    void_reason: reason,
    voided_by: actingUserId,
    voided_at: db.fn.now(),
  });

  await auditLog.write({
    userId: actingUserId,
    action: 'financial.expense_void',
    entityType: 'expense',
    entityId: id,
    newValue: { reason },
    ipAddress,
  });

  return db('expenses').where({ id }).first();
}

async function listExpenses({ startDate, endDate, category }) {
  let query = db('expenses').orderBy('expense_date', 'desc').orderBy('id', 'desc');
  if (startDate) {
    query = query.andWhere('expense_date', '>=', startDate);
  }
  if (endDate) {
    query = query.andWhere('expense_date', '<=', endDate);
  }
  if (category) {
    query = query.andWhere({ category });
  }
  return query;
}

async function createCashDisbursement({ disbursementDate, particulars, amount, givenTo, recordedBy, ipAddress }) {
  if (!disbursementDate || !particulars || !givenTo) {
    throw new ApiError(400, 'disbursementDate, particulars, and givenTo are required.');
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ApiError(400, 'amount must be a positive number.');
  }

  const [created] = await db('cash_disbursements')
    .insert({
      disbursement_date: disbursementDate,
      particulars,
      amount: round2(numericAmount),
      given_to: givenTo,
      recorded_by: recordedBy,
    })
    .returning(['id']);

  await auditLog.write({
    userId: recordedBy,
    action: 'financial.cash_disbursement_create',
    entityType: 'cash_disbursement',
    entityId: created.id,
    newValue: { disbursementDate, particulars, amount: numericAmount, givenTo },
    ipAddress,
  });

  return db('cash_disbursements').where({ id: created.id }).first();
}

async function voidCashDisbursement(id, { reason, actingUserId, ipAddress }) {
  const disbursement = await db('cash_disbursements').where({ id }).first();
  if (!disbursement) {
    throw new ApiError(404, 'Cash disbursement not found.');
  }
  if (disbursement.status === 'voided') {
    throw new ApiError(400, 'This cash disbursement has already been voided.');
  }
  if (!reason) {
    throw new ApiError(400, 'reason is required to void a cash disbursement.');
  }

  await db('cash_disbursements').where({ id }).update({
    status: 'voided',
    void_reason: reason,
    voided_by: actingUserId,
    voided_at: db.fn.now(),
  });

  await auditLog.write({
    userId: actingUserId,
    action: 'financial.cash_disbursement_void',
    entityType: 'cash_disbursement',
    entityId: id,
    newValue: { reason },
    ipAddress,
  });

  return db('cash_disbursements').where({ id }).first();
}

async function listCashDisbursements({ startDate, endDate }) {
  let query = db('cash_disbursements').orderBy('disbursement_date', 'desc').orderBy('id', 'desc');
  if (startDate) {
    query = query.andWhere('disbursement_date', '>=', startDate);
  }
  if (endDate) {
    query = query.andWhere('disbursement_date', '<=', endDate);
  }
  return query;
}

// Sales Journal (BIR Manual Books of Accounts, columnar format — docs/clover-architecture.md
// §0: "pending your accountant/bookkeeper's sign-off before go-live"): one row per collected
// payment, since that's the point an OR number is actually issued and revenue is recognized.
// discount_type comes from the parent billing statement as a flag, not pro-rated into a dollar
// figure per payment — a statement's discount is approved once against the whole statement, and
// splitting it across partial payments would invent a number this system can't actually verify.
async function getSalesJournal({ startDate, endDate }) {
  requireDateRange(startDate, endDate);
  return db('payments')
    .join('billing_statements', 'billing_statements.id', 'payments.billing_statement_id')
    .join('patients', 'patients.id', 'billing_statements.patient_id')
    .where('payments.status', 'active')
    .whereRaw('payments.paid_at::date >= ?', [startDate])
    .whereRaw('payments.paid_at::date <= ?', [endDate])
    .select(
      'payments.id',
      'payments.paid_at',
      'payments.or_number',
      'payments.amount_paid',
      'payments.payment_method',
      'billing_statements.id as statement_id',
      'billing_statements.source_type',
      'billing_statements.discount_type',
      db.raw("patients.first_name || ' ' || patients.last_name as patient_name")
    )
    .orderBy('payments.paid_at');
}

async function listVaccineCosts() {
  return db('inventory_items')
    .whereIn('category', VACCINE_COST_CATEGORIES)
    .andWhere('is_active', true)
    .select('id', 'name', 'category', 'unit', 'current_cost')
    .orderBy('name');
}

async function updateVaccineCost(itemId, { currentCost, actingUserId, ipAddress }) {
  const item = await db('inventory_items').where({ id: itemId }).first();
  if (!item) {
    throw new ApiError(404, 'Inventory item not found.');
  }
  if (!VACCINE_COST_CATEGORIES.includes(item.category)) {
    throw new ApiError(400, `Cost of goods can only be set for items in categories: ${VACCINE_COST_CATEGORIES.join(', ')}`);
  }
  const numericCost = Number(currentCost);
  if (!Number.isFinite(numericCost) || numericCost < 0) {
    throw new ApiError(400, 'currentCost must be a non-negative number.');
  }

  await db('inventory_items').where({ id: itemId }).update({ current_cost: round2(numericCost) });

  await auditLog.write({
    userId: actingUserId,
    action: 'financial.vaccine_cost_update',
    entityType: 'inventory_item',
    entityId: itemId,
    oldValue: { currentCost: item.current_cost !== null ? Number(item.current_cost) : null },
    newValue: { currentCost: numericCost },
    ipAddress,
  });

  return db('inventory_items').where({ id: itemId }).first();
}

async function listDoctorFees() {
  return db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .leftJoin('doctor_fees', 'doctor_fees.user_id', 'users.id')
    .where('roles.name', 'Doctor')
    .andWhere('users.is_active', true)
    .select(
      'users.id as user_id',
      'users.full_name',
      db.raw('coalesce(doctor_fees.fee_amount, 0) as fee_amount'),
      'doctor_fees.updated_at'
    )
    .orderBy('users.full_name');
}

async function updateDoctorFee(userId, { feeAmount, actingUserId, ipAddress }) {
  const doctor = await db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .where('users.id', userId)
    .andWhere('roles.name', 'Doctor')
    .select('users.id', 'users.full_name')
    .first();
  if (!doctor) {
    throw new ApiError(404, 'Doctor not found.');
  }
  const numericFee = Number(feeAmount);
  if (!Number.isFinite(numericFee) || numericFee < 0) {
    throw new ApiError(400, 'feeAmount must be a non-negative number.');
  }

  const before = await db('doctor_fees').where({ user_id: userId }).first();
  await db('doctor_fees')
    .insert({ user_id: userId, fee_amount: round2(numericFee), updated_by: actingUserId, updated_at: db.fn.now() })
    .onConflict('user_id')
    .merge({ fee_amount: round2(numericFee), updated_by: actingUserId, updated_at: db.fn.now() });

  await auditLog.write({
    userId: actingUserId,
    action: 'financial.doctor_fee_update',
    entityType: 'doctor_fee',
    entityId: userId,
    oldValue: { feeAmount: before ? Number(before.fee_amount) : null },
    newValue: { feeAmount: numericFee },
    ipAddress,
  });

  return db('users')
    .leftJoin('doctor_fees', 'doctor_fees.user_id', 'users.id')
    .where('users.id', userId)
    .select('users.id as user_id', 'users.full_name', db.raw('coalesce(doctor_fees.fee_amount, 0) as fee_amount'), 'doctor_fees.updated_at')
    .first();
}

/**
 * Sums the current cost (inventory_items.current_cost, Management-editable — see
 * updateVaccineCost) of every vaccine/RIG item actually administered (doses + RIG, both linked
 * to a tracked batch) for a set of animal_bite_records. Uses the item's current standing cost,
 * not the historical per-batch purchase price (inventory_batches.unit_cost) — Management sets
 * one figure per vaccine and updates it as pricing changes, rather than needing to type a cost
 * in every time a shipment arrives. Doses/RIG given using the free-text batch_lot_number instead
 * of a tracked inventoryBatchId contribute nothing here — there's no item to look a cost up for.
 */
async function getAnimalBiteCostOfGoods(animalBiteRecordIds) {
  if (animalBiteRecordIds.length === 0) {
    return new Map();
  }

  const [doseCosts, rigCosts] = await Promise.all([
    db('abc_treatment_doses')
      .join('inventory_batches', 'inventory_batches.id', 'abc_treatment_doses.inventory_batch_id')
      .join('inventory_items', 'inventory_items.id', 'inventory_batches.inventory_item_id')
      .whereIn('abc_treatment_doses.animal_bite_record_id', animalBiteRecordIds)
      .andWhere('abc_treatment_doses.status', 'administered')
      .select('abc_treatment_doses.animal_bite_record_id as record_id', 'inventory_items.current_cost'),
    db('abc_rig_administrations')
      .join('inventory_batches', 'inventory_batches.id', 'abc_rig_administrations.inventory_batch_id')
      .join('inventory_items', 'inventory_items.id', 'inventory_batches.inventory_item_id')
      .whereIn('abc_rig_administrations.animal_bite_record_id', animalBiteRecordIds)
      .select('abc_rig_administrations.animal_bite_record_id as record_id', 'inventory_items.current_cost'),
  ]);

  const costByRecord = new Map();
  for (const row of [...doseCosts, ...rigCosts]) {
    const current = costByRecord.get(row.record_id) || 0;
    costByRecord.set(row.record_id, round2(current + Number(row.current_cost || 0)));
  }
  return costByRecord;
}

/**
 * Looks up each doctor's configured fee (doctor_fees.fee_amount, defaulting to 0 for a doctor
 * with no row yet) for a set of billing statements, keyed by statement id — via the doctor_id
 * already recorded on the underlying animal_bite_record/consultation (set when that record's
 * diagnosis was recorded). Manual charges have no clinical record to attribute a doctor to, so
 * they're simply absent from the returned map (callers default to 0).
 */
async function getDoctorFeesForStatements(statements) {
  const abRecordIds = statements.filter((s) => s.source_type === 'animal_bite').map((s) => s.source_id);
  const consultationIds = statements.filter((s) => s.source_type === 'consultation').map((s) => s.source_id);

  const [abDoctors, consultDoctors] = await Promise.all([
    abRecordIds.length
      ? db('animal_bite_records').whereIn('id', abRecordIds).select('id', 'doctor_id')
      : [],
    consultationIds.length
      ? db('consultations').whereIn('id', consultationIds).select('id', 'doctor_id')
      : [],
  ]);

  const doctorIdByRecord = new Map([
    ...abDoctors.map((r) => [`animal_bite:${r.id}`, r.doctor_id]),
    ...consultDoctors.map((r) => [`consultation:${r.id}`, r.doctor_id]),
  ]);

  const doctorIds = [...new Set([...doctorIdByRecord.values()].filter((id) => id !== null))];
  const fees = doctorIds.length ? await db('doctor_fees').whereIn('user_id', doctorIds).select('user_id', 'fee_amount') : [];
  const feeByDoctorId = new Map(fees.map((f) => [f.user_id, Number(f.fee_amount)]));

  const feeByStatement = new Map();
  for (const s of statements) {
    if (s.source_type !== 'animal_bite' && s.source_type !== 'consultation') {
      continue;
    }
    const doctorId = doctorIdByRecord.get(`${s.source_type}:${s.source_id}`);
    feeByStatement.set(s.id, doctorId ? feeByDoctorId.get(doctorId) || 0 : 0);
  }
  return feeByStatement;
}

/**
 * "Purchases" (formerly Sales Ledger — renamed and redesigned, not just relabeled, per a
 * direct request): per-patient sale profitability, not a daily cash-flow total. One row per
 * billing statement (not per payment, unlike Sales Journal) — a statement can have several
 * partial payments, and attributing the statement's full cost of goods/doctor's fee to *every*
 * one of those payments would double-count both figures. A statement is included if it has at
 * least one active payment with paid_at in [startDate, endDate]; its "sales" figure is the
 * statement's full amount collected to date (all active payments, not just the ones inside this
 * range) — the simplest option that still avoids double-counting when the same statement is
 * paid off across more than one reporting period, at the cost of that revenue amount not being
 * strictly scoped to the date range in the rare case a statement is paid across periods.
 *
 * Cost of goods is only ever non-zero for animal_bite statements with inventory-tracked doses/
 * RIG (see getAnimalBiteCostOfGoods) — consultations and manual charges don't have equivalent
 * per-visit inventory consumption tracked anywhere in this system, so their cost of goods is
 * always 0, not a missing/unknown value. Doctor's fee comes from doctor_fees (see
 * getDoctorFeesForStatements), keyed by the specific doctor who performed that service — not a
 * flat per-source-type default — so two visits of the same type can carry different fees if a
 * different doctor handled each one.
 */
async function getPurchases({ startDate, endDate }) {
  requireDateRange(startDate, endDate);

  const statementIds = await db('payments')
    .join('billing_statements', 'billing_statements.id', 'payments.billing_statement_id')
    .where('payments.status', 'active')
    .whereRaw('payments.paid_at::date >= ?', [startDate])
    .whereRaw('payments.paid_at::date <= ?', [endDate])
    .distinct('billing_statements.id')
    .pluck('billing_statements.id');

  if (statementIds.length === 0) {
    return [];
  }

  const statements = await db('billing_statements')
    .join('patients', 'patients.id', 'billing_statements.patient_id')
    .whereIn('billing_statements.id', statementIds)
    .select(
      'billing_statements.id',
      'billing_statements.source_type',
      'billing_statements.source_id',
      'billing_statements.created_at',
      db.raw("patients.first_name || ' ' || patients.last_name as patient_name")
    );

  const [paidTotals, costByRecord, feeByStatement] = await Promise.all([
    db('payments')
      .whereIn('billing_statement_id', statementIds)
      .andWhere('status', 'active')
      .groupBy('billing_statement_id')
      .select('billing_statement_id', db.raw('sum(amount_paid) as total_paid')),
    getAnimalBiteCostOfGoods(statements.filter((s) => s.source_type === 'animal_bite').map((s) => s.source_id)),
    getDoctorFeesForStatements(statements),
  ]);

  const paidByStatement = new Map(paidTotals.map((row) => [row.billing_statement_id, Number(row.total_paid)]));

  return statements
    .map((s) => {
      const salesAmount = round2(paidByStatement.get(s.id) || 0);
      const costOfGoods = s.source_type === 'animal_bite' ? round2(costByRecord.get(s.source_id) || 0) : 0;
      const doctorFee = round2(feeByStatement.get(s.id) || 0);
      return {
        statementId: s.id,
        date: s.created_at,
        patientName: s.patient_name,
        sourceType: s.source_type,
        salesAmount,
        costOfGoods,
        doctorFee,
        netAmount: round2(salesAmount - costOfGoods - doctorFee),
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function getSummary({ startDate, endDate }) {
  requireDateRange(startDate, endDate);
  const [revenueRow] = await db('payments')
    .where('status', 'active')
    .whereRaw('paid_at::date >= ?', [startDate])
    .whereRaw('paid_at::date <= ?', [endDate])
    .select(db.raw('coalesce(sum(amount_paid), 0) as total'));

  const [expenseRow] = await db('expenses')
    .where('status', 'active')
    .andWhere('expense_date', '>=', startDate)
    .andWhere('expense_date', '<=', endDate)
    .select(db.raw('coalesce(sum(amount), 0) as total'));

  const [disbursementRow] = await db('cash_disbursements')
    .where('status', 'active')
    .andWhere('disbursement_date', '>=', startDate)
    .andWhere('disbursement_date', '<=', endDate)
    .select(db.raw('coalesce(sum(amount), 0) as total'));

  const totalRevenue = round2(Number(revenueRow.total));
  const totalExpenses = round2(Number(expenseRow.total));
  const totalCashDisbursements = round2(Number(disbursementRow.total));
  return {
    startDate,
    endDate,
    totalRevenue,
    totalExpenses,
    totalCashDisbursements,
    netProfit: round2(totalRevenue - totalExpenses - totalCashDisbursements),
  };
}

module.exports = {
  EXPENSE_CATEGORIES,
  VACCINE_COST_CATEGORIES,
  createExpense,
  voidExpense,
  listExpenses,
  createCashDisbursement,
  voidCashDisbursement,
  listCashDisbursements,
  getSalesJournal,
  getPurchases,
  getSummary,
  listVaccineCosts,
  updateVaccineCost,
  listDoctorFees,
  updateDoctorFee,
};
