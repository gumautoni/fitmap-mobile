# FitMap v1 — Functional Requirements

## Document status

**Status:** Accepted
**Product:** FitMap  
**Version:** v1  
**Related document:** `product-scope.md`

This document defines the functional requirements currently identified for FitMap v1.

Functional requirements describe observable system behavior and user capabilities.

Implementation technologies and architectural mechanisms are intentionally excluded unless they are part of the required behavior.

---

## 1. Requirement classification

Each requirement uses one of the following scope classifications:

| Classification | Meaning |
| --- | --- |
| Core | Required to deliver the primary FitMap value proposition. |
| Professional | Strongly desired for a complete and production-oriented FitMap v1. |
| Differentiator | Valuable capability evaluated after Core and Professional requirements are stable. |

Requirement identifiers are stable references and should not be reused if a requirement is removed.

---

# 2. Authentication and account management

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-AUTH-001 | Core | The system shall allow a new user to create an account using the required registration information. |
| FR-AUTH-002 | Core | The system shall prevent registration when the provided account identity is already associated with another active account. |
| FR-AUTH-003 | Core | The system shall validate required registration information before creating an account. |
| FR-AUTH-004 | Core | The system shall allow a registered user to authenticate using valid credentials. |
| FR-AUTH-005 | Core | The system shall reject authentication attempts using invalid credentials. |
| FR-AUTH-006 | Core | The system shall maintain an authenticated session after successful login according to the approved session policy. |
| FR-AUTH-007 | Core | The system shall allow an authenticated user to log out. |
| FR-AUTH-008 | Core | The system shall prevent unauthenticated users from accessing functionality that requires authentication. |
| FR-AUTH-009 | Professional | The system shall allow a user to recover access to an account when the authentication credential is forgotten. |
| FR-AUTH-010 | Professional | The system shall allow a user to change the account password after appropriate identity validation. |
| FR-AUTH-011 | Professional | The system shall allow a user to request deletion of their own account and associated personal data according to the approved data-retention policy. |

---

# 3. User profile

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-PROFILE-001 | Core | The system shall allow an authenticated user to view their profile information. |
| FR-PROFILE-002 | Core | The system shall allow an authenticated user to update editable profile information. |
| FR-PROFILE-003 | Professional | The system shall allow a user to configure fitness-related preferences used by relevant FitMap features. |
| FR-PROFILE-004 | Professional | The system shall allow a user to add or update a profile image when profile images are enabled. |
| FR-PROFILE-005 | Professional | The system shall persist user preferences between authenticated sessions. |

---

# 4. Location and gym discovery

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-GYM-001 | Core | The system shall request access to the device location before using location-dependent functionality. |
| FR-GYM-002 | Core | The system shall continue to provide non-location-dependent gym search functionality when location permission is unavailable or denied. |
| FR-GYM-003 | Core | The system shall allow a user to discover gyms based on their current location when permission is available. |
| FR-GYM-004 | Core | The system shall allow a user to search for gyms using a textual location query such as city, neighborhood or address. |
| FR-GYM-005 | Core | The system shall display gym search results in a list. |
| FR-GYM-006 | Core | The system shall display gym search results on an interactive map. |
| FR-GYM-007 | Core | The system shall allow a user to select a gym from either the map or the result list. |
| FR-GYM-008 | Core | The system shall display the distance to a gym when sufficient location information is available. |
| FR-GYM-009 | Core | The system shall allow users to refresh or repeat a gym search. |
| FR-GYM-010 | Professional | The system shall allow users to filter gym search results using supported gym attributes. |
| FR-GYM-011 | Professional | The system shall allow users to sort gym results using supported criteria such as distance. |
| FR-GYM-012 | Professional | The system shall preserve relevant search state while the user navigates between search results and gym details when appropriate. |

---

# 5. Gym details

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-GYMDET-001 | Core | The system shall provide a detail view for a selected gym. |
| FR-GYMDET-002 | Core | The gym detail view shall display the gym name and location information when available. |
| FR-GYMDET-003 | Core | The gym detail view shall display distance information when available. |
| FR-GYMDET-004 | Core | The system shall provide access to route or navigation functionality for a gym when valid location data is available. |
| FR-GYMDET-005 | Professional | The gym detail view shall display contact information when available. |
| FR-GYMDET-006 | Professional | The gym detail view shall display opening hours when available. |
| FR-GYMDET-007 | Professional | The gym detail view shall display supported facility or amenity information when available. |
| FR-GYMDET-008 | Professional | The gym detail view shall display gym images when valid images are available. |
| FR-GYMDET-009 | Core | The system shall represent unavailable gym information as unavailable instead of generating fabricated values. |

---

# 6. Favorite gyms

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-FAV-001 | Professional | The system shall allow an authenticated user to add a gym to their favorites. |
| FR-FAV-002 | Professional | The system shall allow an authenticated user to remove a gym from their favorites. |
| FR-FAV-003 | Professional | The system shall allow an authenticated user to view their favorite gyms. |
| FR-FAV-004 | Professional | Favorite gym information shall remain associated with the correct user across authenticated sessions. |

---

# 7. Gym comparison

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-COMP-001 | Differentiator | The system shall allow a user to select supported gyms for comparison. |
| FR-COMP-002 | Differentiator | The system shall present comparable gym attributes in a consistent comparison view. |
| FR-COMP-003 | Differentiator | The system shall clearly indicate when a compared attribute is unavailable for a gym. |

---

# 8. Workout management

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-WORKOUT-001 | Core | The system shall allow an authenticated user to create a workout. |
| FR-WORKOUT-002 | Core | The system shall allow a user to assign a name to a workout. |
| FR-WORKOUT-003 | Core | The system shall allow a user to edit an existing workout. |
| FR-WORKOUT-004 | Core | The system shall allow a user to remove or archive a workout according to the approved workout lifecycle. |
| FR-WORKOUT-005 | Core | The system shall allow a user to add exercises to a workout. |
| FR-WORKOUT-006 | Core | The system shall allow a user to remove exercises from a workout. |
| FR-WORKOUT-007 | Core | The system shall allow a user to configure sets for an exercise within a workout. |
| FR-WORKOUT-008 | Core | The system shall allow a user to define target repetitions for an exercise when applicable. |
| FR-WORKOUT-009 | Core | The system shall allow a user to define target load or weight for an exercise when applicable. |
| FR-WORKOUT-010 | Core | The system shall allow a user to add notes to a workout exercise. |
| FR-WORKOUT-011 | Professional | The system shall allow users to reorder exercises within a workout. |
| FR-WORKOUT-012 | Professional | The system shall allow users to create a custom exercise when an appropriate predefined exercise is unavailable. |
| FR-WORKOUT-013 | Professional | The system shall provide an exercise selection experience for adding supported exercises to workouts. |

---

# 9. Workout sessions and execution

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-SESSION-001 | Core | The system shall allow a user to start a workout session from a configured workout. |
| FR-SESSION-002 | Core | The system shall create a workout execution record associated with the authenticated user. |
| FR-SESSION-003 | Core | The system shall allow users to record completed sets during a workout session. |
| FR-SESSION-004 | Core | The system shall allow users to record actual repetitions performed. |
| FR-SESSION-005 | Core | The system shall allow users to record actual load or weight used when applicable. |
| FR-SESSION-006 | Core | The system shall allow users to mark exercises as completed during a workout session. |
| FR-SESSION-007 | Core | The system shall allow users to finish a workout session. |
| FR-SESSION-008 | Core | The system shall persist completed workout session information in workout history. |
| FR-SESSION-009 | Professional | The system shall allow users to add notes to a workout session or exercise execution. |
| FR-SESSION-010 | Professional | The system shall allow users to cancel an active workout session with an appropriate confirmation flow. |

---

# 10. Workout history

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-HISTORY-001 | Core | The system shall allow an authenticated user to view their workout history. |
| FR-HISTORY-002 | Core | Workout history shall identify when each recorded workout session occurred. |
| FR-HISTORY-003 | Core | The system shall allow a user to inspect the exercises recorded in a historical workout session. |
| FR-HISTORY-004 | Core | Historical workout details shall display recorded sets, repetitions and load when applicable. |
| FR-HISTORY-005 | Professional | The system shall allow users to filter or navigate workout history according to supported time periods or criteria. |
| FR-HISTORY-006 | Professional | Workout history shall remain isolated between different user accounts. |

---

# 11. Progress tracking

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-PROGRESS-001 | Professional | The system shall allow a user to view basic statistics derived from recorded workout activity. |
| FR-PROGRESS-002 | Professional | The system shall allow users to inspect exercise performance evolution when sufficient historical data exists. |
| FR-PROGRESS-003 | Professional | The system shall allow an authenticated user to add a progress photo. |
| FR-PROGRESS-004 | Professional | Progress photos shall be associated with the correct authenticated user and relevant date. |
| FR-PROGRESS-005 | Professional | The system shall allow users to view their previously registered progress photos. |
| FR-PROGRESS-006 | Differentiator | The system shall allow users to record body weight measurements. |
| FR-PROGRESS-007 | Differentiator | The system shall allow users to review body weight history over time. |
| FR-PROGRESS-008 | Differentiator | The system shall allow users to record supported body measurements. |
| FR-PROGRESS-009 | Differentiator | The system shall provide visual progress charts when sufficient historical data exists. |
| FR-PROGRESS-010 | Differentiator | The system shall allow users to define supported personal fitness goals. |
| FR-PROGRESS-011 | Differentiator | The system shall display progress toward supported goals when sufficient data exists. |

---

# 12. Gym ratings and reviews

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-REVIEW-001 | Differentiator | The system shall allow an authenticated user to submit a rating for a gym when reviews are enabled. |
| FR-REVIEW-002 | Differentiator | The system shall allow an authenticated user to submit a written review for a gym when reviews are enabled. |
| FR-REVIEW-003 | Differentiator | The system shall allow users to view available ratings and reviews for a gym. |
| FR-REVIEW-004 | Differentiator | The system shall allow a user to edit their own review according to the approved review policy. |
| FR-REVIEW-005 | Differentiator | The system shall allow a user to remove their own review according to the approved review policy. |
| FR-REVIEW-006 | Differentiator | The system shall prevent a user from editing or deleting another user's review. |
| FR-REVIEW-007 | Differentiator | The system shall provide an appropriate mechanism for reporting inappropriate user-generated reviews when public written reviews are enabled. |

---

# 13. Notifications and reminders

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-NOTIF-001 | Differentiator | The system shall allow a user to enable or disable supported workout reminders. |
| FR-NOTIF-002 | Differentiator | The system shall allow users to configure supported reminder preferences. |
| FR-NOTIF-003 | Differentiator | The system shall respect device notification permissions before delivering notifications. |

---

# 14. User feedback and application states

| ID | Scope | Requirement |
| --- | --- | --- |
| FR-UX-001 | Professional | The system shall provide visible feedback when a user-triggered operation is being processed when appropriate. |
| FR-UX-002 | Professional | The system shall provide an appropriate empty state when a supported view contains no data. |
| FR-UX-003 | Professional | The system shall provide understandable feedback when an operation cannot be completed. |
| FR-UX-004 | Professional | The system shall request device permissions in the context where the related capability is required. |
| FR-UX-005 | Professional | The system shall allow users to retry supported failed network-dependent operations when appropriate. |
| FR-UX-006 | Professional | The system shall provide confirmation before destructive user actions when accidental execution could result in meaningful data loss. |

---

# 15. Functional scope exclusions

The following capabilities are not currently functional requirements for FitMap v1:

| Excluded capability | Current direction |
| --- | --- |
| Social media feed | Future product scope |
| Real-time user chat | Future product scope |
| Personal trainer marketplace | Future product scope |
| Gym membership payment processing | Future product scope |
| Subscription billing | Future product scope |
| Complex wearable integrations | Future product scope |
| Large-scale social networking functionality | Future product scope |

These exclusions may be revisited through a future product-scope decision.

---

# 16. Traceability

Functional requirements should progressively become traceable to:

`Product scope → Functional requirement → Issue → Implementation → Test → Documentation`

Implementation Issues should reference the relevant functional requirement identifiers whenever practical.

Example:

`FR-WORKOUT-001 → Issue → Pull Request → Automated tests`

This traceability is expected to evolve as the FitMap architecture and implementation backlog are defined.

---

# 17. Requirement evolution

This document represents the accepted FitMap v1 functional-requirements baseline.

Requirements may be refined when:

- product behavior becomes more precisely understood;
- architecture exposes additional constraints;
- user experience decisions clarify workflows;
- implementation reveals valid domain rules;
- project scope changes through an explicit decision.

A requirement should not be silently changed when the modification materially affects previously approved product behavior.

Significant scope changes should be reviewed and documented.
