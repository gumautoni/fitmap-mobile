# FitMap v1 — Non-Functional Requirements

## Document status

**Status:** Draft  
**Product:** FitMap  
**Version:** v1  
**Related documents:** `product-scope.md`, `functional-requirements.md`

This document defines the non-functional requirements currently identified for FitMap v1.

Non-functional requirements describe the quality attributes, constraints and operational expectations that the system must satisfy in addition to its functional behavior.

The exact measurable thresholds for some requirements may be refined during architecture, implementation and performance validation.

---

## 1. Requirement classification

Each non-functional requirement uses one of the following priorities:

| Priority | Meaning |
| --- | --- |
| Critical | Required to protect security, data integrity or fundamental system correctness. |
| High | Required for a reliable and production-oriented FitMap v1. |
| Medium | Important quality objective that should be satisfied when technically and operationally appropriate. |

Non-functional requirement identifiers are stable references and should not be reused if a requirement is removed.

---

# 2. Security

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-SEC-001 | Critical | User passwords shall never be stored or transmitted as plain text. |
| NFR-SEC-002 | Critical | Passwords persisted by FitMap shall use an approved password hashing mechanism appropriate for password storage. |
| NFR-SEC-003 | Critical | Authentication secrets, private keys and backend credentials shall not be embedded in mobile application source code or committed to the repository. |
| NFR-SEC-004 | Critical | Authentication and authorization shall be enforced by trusted backend components for protected server-side resources. |
| NFR-SEC-005 | Critical | A user shall not be able to access another user's private workout, progress, profile or account data without explicit authorization. |
| NFR-SEC-006 | Critical | Sensitive communication between the mobile application and backend services shall use encrypted transport in non-local environments. |
| NFR-SEC-007 | High | Authentication failures shall not disclose unnecessary information that could assist account enumeration or credential attacks. |
| NFR-SEC-008 | High | Sensitive mobile-side authentication data shall use an appropriate secure storage mechanism. |
| NFR-SEC-009 | High | User input shall be validated at the appropriate trust boundary before being processed or persisted. |
| NFR-SEC-010 | High | Destructive or security-sensitive operations shall require appropriate authorization checks regardless of client-side validation. |
| NFR-SEC-011 | High | Application dependencies shall be monitored for known security vulnerabilities through appropriate tooling. |
| NFR-SEC-012 | High | Security-relevant implementation decisions shall be documented when they materially affect the system architecture or threat model. |

---

# 3. Privacy and personal data

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-PRIV-001 | Critical | FitMap shall collect only personal data required for defined product functionality or legitimate operational needs. |
| NFR-PRIV-002 | Critical | Private user data shall remain associated with the correct authenticated user. |
| NFR-PRIV-003 | High | The system shall provide a defined process for account deletion and associated personal-data handling. |
| NFR-PRIV-004 | High | Progress photos and other private progress information shall not be publicly exposed by default. |
| NFR-PRIV-005 | High | Location information shall only be accessed when required by an enabled user-facing capability and after appropriate device permission handling. |
| NFR-PRIV-006 | High | Sensitive personal information shall not be written unnecessarily to application logs. |
| NFR-PRIV-007 | High | Data retention behavior shall be documented for relevant personal-data categories before production deployment. |
| NFR-PRIV-008 | Medium | User-facing privacy information shall accurately describe the data actually processed by the application. |

---

# 4. Data integrity

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-DATA-001 | Critical | Persistent domain data shall preserve valid relationships between users, workouts, workout sessions, exercises and progress records. |
| NFR-DATA-002 | Critical | Operations that modify related persistent data shall avoid leaving the system in an inconsistent partial state. |
| NFR-DATA-003 | Critical | Data belonging to different users shall remain logically isolated. |
| NFR-DATA-004 | High | Database schema changes shall be versioned through a controlled migration mechanism. |
| NFR-DATA-005 | High | Application code shall not depend on manual production database changes that are absent from version-controlled migrations. |
| NFR-DATA-006 | High | External gym information shall not be fabricated and presented as real production data. |
| NFR-DATA-007 | High | Missing external data shall be represented explicitly instead of being replaced with misleading generated values. |
| NFR-DATA-008 | High | Relevant timestamps shall be stored and interpreted consistently according to the approved date and time strategy. |

---

# 5. Reliability and error handling

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-REL-001 | High | Expected application failures shall be handled without causing an uncontrolled application crash whenever reasonably possible. |
| NFR-REL-002 | High | Network failures shall produce understandable application behavior and shall not silently corrupt persisted data. |
| NFR-REL-003 | High | External service failures shall be isolated so that unrelated FitMap capabilities can continue functioning when possible. |
| NFR-REL-004 | High | Operations that can safely be retried shall expose an appropriate retry mechanism or recovery path. |
| NFR-REL-005 | High | The system shall provide consistent error responses between backend components and mobile consumers according to an approved error contract. |
| NFR-REL-006 | Medium | Relevant transient external-service failures should use controlled timeout and retry policies rather than indefinite waiting. |
| NFR-REL-007 | Medium | Degraded external-data conditions should be distinguishable from valid empty search results when technically possible. |

---

# 6. Performance

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-PERF-001 | High | Common user interactions shall provide timely visible feedback and shall not leave the interface apparently frozen during processing. |
| NFR-PERF-002 | High | Gym searches shall avoid unnecessary repeated external requests when equivalent recent data can safely be reused. |
| NFR-PERF-003 | High | Large result collections shall use an appropriate pagination, limiting or incremental-loading strategy. |
| NFR-PERF-004 | High | Images displayed by the mobile application shall be delivered and rendered using sizes appropriate to their presentation context. |
| NFR-PERF-005 | Medium | Backend response-time targets shall be defined for critical endpoints after representative infrastructure and workload conditions are established. |
| NFR-PERF-006 | Medium | Performance-sensitive functionality shall be measured before optimization decisions are introduced solely for presumed performance reasons. |

---

# 7. Availability and external dependencies

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-AVAIL-001 | High | FitMap shall not assume that third-party gym, map or geocoding services are permanently available. |
| NFR-AVAIL-002 | High | External integrations shall define explicit timeout behavior. |
| NFR-AVAIL-003 | High | Failures in external gym-discovery services shall not compromise private workout and account data. |
| NFR-AVAIL-004 | Medium | Appropriate caching or provider abstraction should be considered for external services where availability, quotas or rate limits can affect the user experience. |
| NFR-AVAIL-005 | Medium | Production deployment shall define a backup and recovery strategy for persistent FitMap-managed data. |

---

# 8. Maintainability and architecture

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-MAINT-001 | High | The codebase shall maintain clear separation of concerns between product domains and technical infrastructure. |
| NFR-MAINT-002 | High | Business rules shall not depend unnecessarily on user-interface implementation details. |
| NFR-MAINT-003 | High | External service integrations shall be isolated behind appropriate application abstractions. |
| NFR-MAINT-004 | High | Significant architectural decisions shall be documented through Architecture Decision Records when appropriate. |
| NFR-MAINT-005 | High | Source code, technical documentation and implemented behavior shall remain consistent. |
| NFR-MAINT-006 | High | Reusable functionality shall avoid unnecessary duplicated implementation. |
| NFR-MAINT-007 | High | Project structure and naming shall follow documented conventions. |
| NFR-MAINT-008 | Medium | Dependencies should be introduced only when they provide justified value relative to their maintenance and security cost. |
| NFR-MAINT-009 | Medium | Architectural complexity shall remain proportional to product requirements and team capacity. |

---

# 9. Testability and quality assurance

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-TEST-001 | High | Critical business behavior shall be designed so that it can be tested independently of the mobile user interface when appropriate. |
| NFR-TEST-002 | High | Critical authentication, authorization and data-isolation behavior shall have automated tests. |
| NFR-TEST-003 | High | Backend persistence flows shall support isolated integration testing. |
| NFR-TEST-004 | High | Automated tests shall not depend on production data. |
| NFR-TEST-005 | High | A failing automated test shall cause the associated validation command to fail. |
| NFR-TEST-006 | High | Pull Request validation shall execute the applicable automated quality checks through CI when the relevant tooling is available. |
| NFR-TEST-007 | Medium | Test coverage metrics may be monitored, but coverage percentage shall not replace meaningful behavioral testing. |
| NFR-TEST-008 | Medium | Regression tests should be added for significant defects when an automated reproduction is practical. |

---

# 10. Observability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-OBS-001 | High | Backend services shall produce structured operational logs appropriate for diagnosing relevant failures. |
| NFR-OBS-002 | Critical | Application logs shall not expose passwords, authentication credentials or other unnecessary sensitive information. |
| NFR-OBS-003 | High | Relevant server-side errors shall include sufficient diagnostic context without exposing internal implementation details to end users. |
| NFR-OBS-004 | Medium | Production deployment should provide appropriate error monitoring for significant application failures. |
| NFR-OBS-005 | Medium | Relevant health or readiness information should be available for deployed backend services when required by the selected infrastructure. |
| NFR-OBS-006 | Medium | Monitoring strategy should distinguish application failures from third-party dependency failures when practical. |

---

# 11. Accessibility

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-ACC-001 | High | Primary application functionality shall not depend exclusively on color to communicate meaning. |
| NFR-ACC-002 | High | Interactive controls shall provide understandable labels and appropriate accessible semantics where supported by the platform. |
| NFR-ACC-003 | High | Text and essential interface elements shall maintain appropriate visual contrast. |
| NFR-ACC-004 | High | Primary interactive elements shall provide practical touch-target sizes for mobile use. |
| NFR-ACC-005 | Medium | Application flows should remain usable with supported platform text-size accessibility settings whenever practical. |
| NFR-ACC-006 | Medium | Accessibility behavior shall be considered during component and screen implementation rather than postponed exclusively to final polishing. |

---

# 12. Usability and user experience consistency

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-UX-001 | High | Equivalent actions shall use consistent terminology and interaction patterns throughout the application. |
| NFR-UX-002 | High | Loading, empty, success and error states shall be visually distinguishable and understandable. |
| NFR-UX-003 | High | Destructive operations shall provide appropriate confirmation or recovery behavior when accidental activation could cause meaningful data loss. |
| NFR-UX-004 | High | Validation errors shall identify the affected input or action in a way understandable to the user. |
| NFR-UX-005 | Medium | Main user journeys should minimize unnecessary navigation steps and repeated data entry. |
| NFR-UX-006 | Medium | Product terminology shall remain consistent across mobile interfaces, API documentation and product documentation where applicable. |

---

# 13. Compatibility

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-COMPAT-001 | High | The supported FitMap mobile platforms shall be explicitly documented. |
| NFR-COMPAT-002 | High | Functionality shall not be documented as supported on a platform unless it is intentionally supported and validated. |
| NFR-COMPAT-003 | High | Platform-specific permissions and capabilities shall be handled according to the supported mobile platform behavior. |
| NFR-COMPAT-004 | Medium | Supported minimum mobile operating-system versions shall be defined before production distribution. |
| NFR-COMPAT-005 | Medium | Dependency and framework upgrades shall be validated against supported platforms before adoption. |

---

# 14. Configuration and environments

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-CONFIG-001 | Critical | Secrets and production credentials shall not be committed to source control. |
| NFR-CONFIG-002 | High | Environment-specific configuration shall be separated from application source code where appropriate. |
| NFR-CONFIG-003 | High | The repository shall provide safe example configuration for developers when environment variables are required. |
| NFR-CONFIG-004 | High | Development, testing and production configuration shall not unintentionally share sensitive production resources. |
| NFR-CONFIG-005 | Medium | Configuration requirements shall be documented sufficiently for another authorized developer to reproduce the development environment. |

---

# 15. Version control and collaboration

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-VCS-001 | High | The `main` branch shall represent the integrated project state and shall be protected according to the repository collaboration policy. |
| NFR-VCS-002 | High | Changes intended for `main` shall be submitted through Pull Requests. |
| NFR-VCS-003 | High | Repository changes shall follow the documented branch and commit conventions. |
| NFR-VCS-004 | High | Pull Requests shall be validated through applicable automated checks as the CI infrastructure becomes available. |
| NFR-VCS-005 | High | Generated files, dependencies, secrets and local environment artifacts shall not be committed unless explicitly required and justified. |
| NFR-VCS-006 | Medium | Repository history should remain understandable and logically organized for future contributors and project review. |

---

# 16. Documentation

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-DOC-001 | High | Technical documentation shall reflect the implemented system rather than presenting planned capabilities as completed functionality. |
| NFR-DOC-002 | High | Relevant setup, execution and testing instructions shall be reproducible by another authorized developer. |
| NFR-DOC-003 | High | Significant architecture decisions shall include rationale and relevant trade-offs. |
| NFR-DOC-004 | High | Functional and non-functional requirements shall remain version-controlled with the source repository. |
| NFR-DOC-005 | Medium | Relevant requirements should become traceable to implementation Issues, Pull Requests and tests as the project evolves. |
| NFR-DOC-006 | Medium | Academic documentation and repository documentation shall remain conceptually consistent while serving their different audiences. |

---

# 17. Deployment and delivery

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-DEPLOY-001 | High | Production deployment shall be reproducible through documented procedures and version-controlled configuration where appropriate. |
| NFR-DEPLOY-002 | High | Deployment shall not require storing production secrets directly in the repository. |
| NFR-DEPLOY-003 | High | Production database schema changes shall use the approved migration process. |
| NFR-DEPLOY-004 | Medium | Automated deployment shall only occur after the required validation checks for the selected environment have succeeded. |
| NFR-DEPLOY-005 | Medium | A rollback or recovery strategy shall be defined for relevant production deployment failures before public production use. |

---

# 18. Scalability

| ID | Priority | Requirement |
| --- | --- | --- |
| NFR-SCALE-001 | Medium | The initial architecture shall avoid design decisions that unnecessarily prevent horizontal or vertical scaling of backend workloads. |
| NFR-SCALE-002 | Medium | Scaling mechanisms shall not be introduced solely for hypothetical traffic without evidence that the additional complexity is justified. |
| NFR-SCALE-003 | Medium | External service quotas and rate limits shall be considered when designing gym discovery and location-dependent functionality. |
| NFR-SCALE-004 | Medium | Data-access patterns expected to grow significantly shall be designed to support appropriate indexing, pagination or query optimization strategies. |

---

# 19. Non-functional validation

Non-functional requirements should progressively become traceable to architecture, implementation and validation mechanisms.

Examples:

`NFR-SEC-005 → Authorization design → Integration tests`

`NFR-PERF-003 → API pagination design → Performance validation`

`NFR-DATA-004 → Migration tooling → CI validation`

`NFR-ACC-002 → Mobile component implementation → Accessibility review`

Not every non-functional requirement will be validated by the same mechanism.

Validation may include:

- automated tests;
- static analysis;
- security scanning;
- integration tests;
- performance measurements;
- code review;
- architecture review;
- manual accessibility validation;
- deployment validation;
- documentation review.

---

# 20. Requirement evolution

This document is currently a draft.

Quantitative thresholds should be introduced when the architecture, infrastructure and representative operating conditions make those thresholds meaningful and testable.

Non-functional requirements may be refined when:

- architecture decisions clarify technical constraints;
- implementation provides measurable performance information;
- deployment infrastructure is selected;
- security analysis identifies additional controls;
- accessibility validation identifies platform-specific requirements;
- operational experience reveals reliability needs.

Material changes to Critical or High priority requirements should be reviewed and documented explicitly.