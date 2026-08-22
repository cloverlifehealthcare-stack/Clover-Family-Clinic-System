// Starter catalog so billing_items has something to reference out of the box. Placeholder
// pricing — the clinic should review/adjust every default_price via PATCH /api/services
// before relying on this for real charges. Manual (no service_id) line items always remain
// available for anything not in this list.
const SERVICES = [
  { name: 'Medical Consultation', category: 'consultation', default_price: 300.0 },
  { name: 'Animal Bite Initial Assessment', category: 'animal_bite', default_price: 250.0 },
  { name: 'Anti-Rabies Vaccine (per dose)', category: 'vaccination', default_price: 450.0 },
  { name: 'Rabies Immunoglobulin (RIG)', category: 'vaccination', default_price: 3500.0 },
  { name: 'Wound Dressing', category: 'other', default_price: 150.0 },
  { name: 'Medical Certificate', category: 'other', default_price: 100.0 },
];

exports.seed = async function seed(knex) {
  await knex('services').insert(SERVICES);
};
