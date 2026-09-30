# Changelog
 
---
 
## [1.3.0] - 2026-09-29
 
### Added
- Added file attachment support and extended fields (`country`, `enquiry_type`) to the Contact Sales form, including robust backend multi-part form data parsing
 
### Changed
- Unified Razorpay plan configurations to pull dynamically from the database instead of relying on environment variables
- Standardized billing cycle terminology across the application (replaced "Yearly" with "Annual")
- Improved UI styling for invitation management flows
 
### Fixed
- Resolved a critical bug where upgrading a subscription would create duplicate subscription rows per user in the database
 
## [1.2.0] - 2026-09-25
 
### Added
- NoSQL database integration and support
- Razorpay payment gateway integration
 
### Changed
- Annual pricing input made directly editable in admin plan management
- Dynamic rendering of overall discount percentage from API
 
### Fixed
- Upgrade modal plan card layout to align action CTA buttons directly under price section
- Visual rendering and logo fixes for MongoDB, MySQL, and SQLite3 logos
 
## [1.1.0] - 2026-09-22
 
### Added
- SQL Compare feature integrated with Version History for side-by-side DBML diff viewing
- Sidebar navigation icons to replace header feature buttons for a cleaner, more accessible layout
- SMTP mail integration
- Import and export as SQLLite
- Google Analytics integration
 
### Changed
- Moved feature shortcuts from the top header bar into the side navigation panel
 
### Fixed
- Logo shadow rendering issue in UI
- SQL Compare visual and functional bugs
 
## Initial Release
 
### Added
- Realtime Collaboration
- Version History
- Import as MySQL, SQL Server, PostgreSQL
- Export as PNG, SVG, PDF, MySQL, SQL Server, PostgreSQL
- Table Grouping
- Share Diagram
- Collaborative Workspace