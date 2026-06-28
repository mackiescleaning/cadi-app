// Catalogue seam — Phase D of the Cadi Master Build Plan.
//
// One pricing brain, many faces. Every surface (Front Desk widget, booking
// portal, scheduler, photo-quoter, monthly reports, Cadi Score) MUST read
// the catalogue through these two functions. No surface implements its own
// pricing maths or touches services / service_tiers / service_units /
// service_modifiers directly. Add a service in the menu, every surface
// updates with zero surface-side code.

export { getCatalogue, shapeService } from './getCatalogue.js';
export { quotePrice }                 from './quotePrice.js';
