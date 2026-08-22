const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

const EXPENSE_CATEGORIES = ['supplies', 'utilities', 'rent', 'salaries', 'equipment', 'maintenance', 'other'];

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

// Sales Ledger: the same payments, grouped into daily totals with a running cumulative
// balance across the period — the summary book, not the transaction-level detail.
async function getSalesLedger({ startDate, endDate }) {
  requireDateRange(startDate, endDate);
  const rows = await db('payments')
    .where('payments.status', 'active')
    .whereRaw('payments.paid_at::date >= ?', [startDate])
    .whereRaw('payments.paid_at::date <= ?', [endDate])
    .select(
      db.raw('payments.paid_at::date as sale_date'),
      db.raw('count(*) as transaction_count'),
      db.raw('sum(payments.amount_paid) as total_amount')
    )
    .groupByRaw('payments.paid_at::date')
    .orderBy('sale_date');

  let running = 0;
  return rows.map((row) => {
    running = round2(running + Number(row.total_amount));
    return {
      date: row.sale_date,
      transactionCount: Number(row.transaction_count),
      totalAmount: round2(Number(row.total_amount)),
      runningTotal: running,
    };
  });
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

  const totalRevenue = round2(Number(revenueRow.total));
  const totalExpenses = round2(Number(expenseRow.total));
  return { startDate, endDate, totalRevenue, totalExpenses, netProfit: round2(totalRevenue - totalExpenses) };
}

module.exports = {
  EXPENSE_CATEGORIES,
  createExpense,
  voidExpense,
  listExpenses,
  getSalesJournal,
  getSalesLedger,
  getSummary,
};
