const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

const EXPENSE_CATEGORIES = ['supplies', 'utilities', 'rent', 'salaries', 'equipment', 'maintenance', 'other'];
const VACCINE_COST_CATEGORIES = ['vaccine', 'rig'];
const CASH_DISBURSEMENT_CATEGORIES = ['doctors_fee', 'other'];
const CASH_DISBURSEMENT_CATEGORY_LABELS = { doctors_fee: "Doctor's Daily Fee", other: 'Other' };

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(header, rows) {
  return [header.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

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

async function createCashDisbursement({ disbursementDate, category, particulars, amount, givenTo, recordedBy, ipAddress }) {
  if (!disbursementDate || !category || !particulars || !givenTo) {
    throw new ApiError(400, 'disbursementDate, category, particulars, and givenTo are required.');
  }
  if (!CASH_DISBURSEMENT_CATEGORIES.includes(category)) {
    throw new ApiError(400, `category must be one of: ${CASH_DISBURSEMENT_CATEGORIES.join(', ')}`);
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ApiError(400, 'amount must be a positive number.');
  }

  const [created] = await db('cash_disbursements')
    .insert({
      disbursement_date: disbursementDate,
      category,
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
    newValue: { disbursementDate, category, particulars, amount: numericAmount, givenTo },
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
 * "Purchases" (formerly Sales Ledger — renamed and redesigned, not just relabeled, per a
 * direct request): per-patient sale profitability, not a daily cash-flow total. One row per
 * billing statement (not per payment, unlike Sales Journal) — a statement can have several
 * partial payments, and attributing the statement's full cost of goods to *every* one of those
 * payments would double-count it. A statement is included if it has at least one active payment
 * with paid_at in [startDate, endDate]; its "sales" figure is the statement's full amount
 * collected to date (all active payments, not just the ones inside this range) — the simplest
 * option that still avoids double-counting when the same statement is paid off across more than
 * one reporting period, at the cost of that revenue amount not being strictly scoped to the date
 * range in the rare case a statement is paid across periods.
 *
 * Cost of goods is only ever non-zero for animal_bite statements with inventory-tracked doses/
 * RIG (see getAnimalBiteCostOfGoods) — consultations and manual charges don't have equivalent
 * per-visit inventory consumption tracked anywhere in this system, so their cost of goods is
 * always 0, not a missing/unknown value.
 *
 * Doctor's fee deliberately does NOT appear here (removed post-launch, at the clinic's explicit
 * correction): doctors are paid a variable daily amount based on hours worked or patients seen,
 * not a fixed rate per visit or per doctor, so there's no accurate per-visit figure to attribute.
 * The clinic records what's actually paid out via Cash Disbursement instead, which already nets
 * against the clinic-wide Net Profit in getSummary — just not allocated to one specific visit.
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

  const [paidTotals, costByRecord] = await Promise.all([
    db('payments')
      .whereIn('billing_statement_id', statementIds)
      .andWhere('status', 'active')
      .groupBy('billing_statement_id')
      .select('billing_statement_id', db.raw('sum(amount_paid) as total_paid')),
    getAnimalBiteCostOfGoods(statements.filter((s) => s.source_type === 'animal_bite').map((s) => s.source_id)),
  ]);

  const paidByStatement = new Map(paidTotals.map((row) => [row.billing_statement_id, Number(row.total_paid)]));

  return statements
    .map((s) => {
      const salesAmount = round2(paidByStatement.get(s.id) || 0);
      const costOfGoods = s.source_type === 'animal_bite' ? round2(costByRecord.get(s.source_id) || 0) : 0;
      return {
        statementId: s.id,
        date: s.created_at,
        patientName: s.patient_name,
        sourceType: s.source_type,
        salesAmount,
        costOfGoods,
        netAmount: round2(salesAmount - costOfGoods),
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

async function exportSalesJournalCsv({ startDate, endDate }) {
  const rows = await getSalesJournal({ startDate, endDate });
  return toCsv(
    ['Date', 'OR Number', 'Payor', 'Particulars', 'Discount', 'Method', 'Amount'],
    rows.map((r) => [
      new Date(r.paid_at).toLocaleDateString(),
      r.or_number,
      r.patient_name,
      r.source_type.replace('_', ' '),
      r.discount_type === 'none' ? '—' : r.discount_type.toUpperCase(),
      r.payment_method,
      Number(r.amount_paid).toFixed(2),
    ])
  );
}

async function exportPurchasesCsv({ startDate, endDate }) {
  const rows = await getPurchases({ startDate, endDate });
  return toCsv(
    ['Date', 'Patient', 'Service', 'Sales', 'Cost of Goods', 'Net'],
    rows.map((r) => [
      new Date(r.date).toLocaleDateString(),
      r.patientName,
      r.sourceType.replace('_', ' '),
      r.salesAmount.toFixed(2),
      r.costOfGoods.toFixed(2),
      r.netAmount.toFixed(2),
    ])
  );
}

async function exportExpensesCsv({ startDate, endDate }) {
  const rows = await listExpenses({ startDate, endDate });
  return toCsv(
    ['Date', 'Category', 'Description', 'Paid To', 'Amount', 'Status'],
    rows.map((r) => [r.expense_date, r.category, r.description, r.paid_to || '', Number(r.amount).toFixed(2), r.status])
  );
}

async function exportCashDisbursementsCsv({ startDate, endDate }) {
  const rows = await listCashDisbursements({ startDate, endDate });
  return toCsv(
    ['Date', 'Particulars', 'Reason', 'Amount', 'Given To', 'Status'],
    rows.map((r) => [
      r.disbursement_date,
      CASH_DISBURSEMENT_CATEGORY_LABELS[r.category] || r.category,
      r.particulars,
      Number(r.amount).toFixed(2),
      r.given_to,
      r.status,
    ])
  );
}

// The "full report": the same Total Revenue/Expenses/Cash Disbursement/Net Profit figures shown
// on the Summary section, as a downloadable CSV with the formula spelled out as its own row —
// requested separately from the four per-section exports above, as the one-file bottom-line
// summary rather than a transaction-level report.
async function exportFullReportCsv({ startDate, endDate }) {
  const summary = await getSummary({ startDate, endDate });
  return toCsv(
    ['Metric', 'Amount'],
    [
      ['Period', `${startDate} to ${endDate}`],
      ['Total Revenue', summary.totalRevenue.toFixed(2)],
      ['Total Expenses', summary.totalExpenses.toFixed(2)],
      ['Total Cash Disbursement', summary.totalCashDisbursements.toFixed(2)],
      ['Net Profit', summary.netProfit.toFixed(2)],
      ['Formula', 'Total Revenue - Total Expenses - Total Cash Disbursement = Net Profit'],
    ]
  );
}

module.exports = {
  EXPENSE_CATEGORIES,
  VACCINE_COST_CATEGORIES,
  CASH_DISBURSEMENT_CATEGORIES,
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
  exportSalesJournalCsv,
  exportPurchasesCsv,
  exportExpensesCsv,
  exportCashDisbursementsCsv,
  exportFullReportCsv,
};
