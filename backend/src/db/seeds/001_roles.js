const ROLES = [
  { name: 'Management', description: 'Full system access; only role that can manage staff accounts and view financial reports by default.' },
  { name: 'Admin', description: 'Front-office administration: patients, appointments, billing, payment voids.' },
  { name: 'Doctor', description: 'Clinical staff: assessments, diagnoses, prescriptions, treatment administration.' },
  { name: 'Nurse', description: 'Clinical support staff: initial assessments, treatment administration, patient education.' },
  { name: 'Cashier', description: 'Billing and payment processing only.' },
];

exports.seed = async function seed(knex) {
  await knex('roles').insert(ROLES);
};
