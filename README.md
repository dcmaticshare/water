# i-Water Installation Console

Open index.html directly, or serve the folder locally:

    python3 -m http.server 8765

Then open http://127.0.0.1:8765/.

The application uses the production hierarchy **Customer → Location → Project → Unit → Water Project**. Physical modules, ports, and components are owned by a Unit and linked to Water Projects through allocation records.

The generated configuration schema drives the settings available throughout the application. Every setting is typed, locally persisted and placed under its owning structure:

- **User Admin** fields are available under **Users**.
- **Location**, **Project**, and **Unit** fields are available on their detail pages.
- **Water Project** settings are split across **Info**, **Connections**, **Protocols**, and **Notifications**.

Settings are grouped by production workflow: identity, address, connectivity, equipment setup, measurement, dosing, alarms, maintenance and related functions. Run the configuration completeness check after changing the generated schema:

    node scripts/verify-source-coverage.mjs

Water Project **Connections** and **Protocols** use the same full-width accordion pattern. Every section is collapsed by default; click the row or its arrow to reveal the operational details.

Device actions are recorded locally as requested activity; connecting those requests to real hardware requires the production API and command-delivery service.
