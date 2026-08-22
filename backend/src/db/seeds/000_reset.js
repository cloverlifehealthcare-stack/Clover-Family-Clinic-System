// Dev-only reset so `npm run seed` is repeatable against a scratch database.
// Deletes in FK-safe order (children before parents) — every new module that adds a table
// referencing users (or patients) needs a `.del()` line here, above the `users` line, or
// this breaks the same way it did when the patients table was added. Never run against
// production data — this seed set is for standing up local/staging environments, not go-live.
exports.seed = async function seed(knex) {
  await knex('payments').del(); // references billing_statements + users
  await knex('billing_items').del(); // references billing_statements + services
  await knex('billing_statements').del(); // references patients + users
  await knex('services').del();
  await knex('appointments').del(); // references patients + users
  await knex('prescription_items').del(); // references prescriptions
  await knex('prescriptions').del(); // references consultations + animal_bite_records + patients + users
  await knex('consultations').del(); // references patients + users
  await knex('abc_rig_administrations').del(); // references animal_bite_records + users
  await knex('abc_treatment_doses').del(); // references animal_bite_records + users
  await knex('inventory_adjustments').del(); // references inventory_batches + users
  await knex('inventory_batches').del(); // references inventory_items + users
  await knex('inventory_items').del();
  await knex('follow_ups').del(); // references patients + users
  await knex('patient_education_logs').del(); // references patients + users
  await knex('animal_bite_records').del(); // references patients + users
  await knex('patient_code_sequences').del();
  await knex('patients').del(); // references users.id — must go before users
  await knex('user_permissions').del();
  await knex('audit_logs').del();
  await knex('users').del();
  await knex('role_permissions').del();
  await knex('permissions').del();
  await knex('roles').del();
};
