# Changes in this update

## Run these migrations in Supabase (SQL editor or `supabase db push`), in order
1. `20261101090000_spares_misc_last_changed.sql` – Miscellaneous spares category, `last_changed_date`, fixes category check and history columns.
2. `20261101100000_roles_mileage_costs_revenue.sql` – new roles, `driver_mileage`, `truck_revenue`, `cost_entries`, `driver_salaries`.

## Roles (one role per login)
| Role (Users page label) | DB value | Account | Sees |
|---|---|---|---|
| Corporate Admin | `corporate_admin` | master | everything + Cost Reports |
| Manager | `manager` | one sub-account | all that sub-account's pages incl. Mileage and Cost Reports (own sub-account) |
| Spares | `spares_clerk` | master (universal) | 4 spares pages (MCL, CSL, PN Mashru, Tarmal) + Tyres (sub-account switcher) |
| Sales & Reports | `reports_clerk` | master (universal) | Reports & Costs (all sub-accounts, truck filter), can edit Spares and Tyres |
| Operations | `employee` | one sub-account each | Dashboard, Trips, Fuel, Mileage, Tallies, Drivers, Trucks, Containers (no spares / reports) |

To create a clerk: the person signs up, then a Corporate Admin sets their role on the **Users** page
(sub-account is set to `master` automatically).

## New / changed pages
- **Spares**: Last Changed column + field (auto-stamped on install/remove/repair/retire), Miscellaneous tab, truck filter, sub-account pages for the Spares clerk.
- **Tyres**: fitted-on position is now a Truck / Trailer position dropdown, plus the sub-account switcher for clerks.
- **Mileage** (new): per driver + truck + trip, filter by truck, driver, trip and dates, totals per driver and truck.
- **Reports & Costs** (new): Truck Summary (revenue − fuel − spares − tyres − driver salaries − other = profit, CSV export),
  Revenue entry, Maintenance & Truck Cost (spares, tyres, fuel), Financial Cost (insurance, loan, leasing),
  Employment Cost (labour, consultancy, driver salaries), Overhead Cost (rent, internet, electricity, water).
- **Truck filter** added to Trips, Tallies and Containers (Fuel, Spares and Tyres already had one).

## Known limits
- Spares are costed when installed (unit cost), tyres when fitted, fuel from the Fuel page. Revenue is entered monthly per truck.
- Most older tables still allow every signed-in user at database level (sub-account separation is in the app). The new money tables are restricted to reports clerk, manager and corporate admin.
- Not compiled or run in the build environment: run `npm install && npm run build` before deploying.

## Update 2: templates and truck / driver filters
- **Download Template** button in the top bar of every page. It gives the right template for the page that is open
  (pages with several data types, such as Compliance, Spares and Reports, show a small menu). New templates: Mileage,
  Truck revenue, Cost entries, Driver salaries, Users.
- The top-bar **Upload** button now only appears on pages the global importer really supports (Trips, Trucks, Spares, Tyres);
  before, it could push fuel/containers/etc. files into the trips table. Other pages keep their own Bulk Import button.
- **Truck + Driver filter** (shared component `TruckDriverFilter.tsx`) on: Trips, Fuel, Tallies, Drivers, Trucks, Containers,
  Compliance (vehicle and driver tabs), Spares, Tyres, Mileage and Reports & Costs. Where a record has only a truck or only a
  driver, the other side is matched through the trips, fuel and mileage records that link drivers to trucks.
- Not filtered: Dashboard, Overview, Live Monitor, the old Reports pages and Users (summary or non-fleet pages).

## Update 3: filter on the remaining pages
- The shared **Truck + Driver filter** is now also on: Dashboard (master summary and sub-account dashboards), Master Fleet
  Summary (Overview), Live Monitor, Reports (sub-account) and Reports — Master. Totals, charts, counts and the PDF export on the
  report pages follow the filter. (Fuel and Mileage already had their own truck and driver dropdowns.)
- `filterReportData` / `filterTyres` helpers added to `TruckDriverFilter.tsx` for report-style pages.
- **Users** has no truck or driver data (it lists logins), so there is nothing to filter there; it still has the template download.
- **Download Template** stays in the top bar of every page (all roles, all portals).
- Not compiled in the build environment (no network for `npm install`): only a syntax check was run. Run `npm install && npm run build` before deploying.
