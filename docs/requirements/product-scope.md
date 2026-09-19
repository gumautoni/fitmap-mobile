# FitMap v1 — Product Scope

## Document status

**Status:** Accepted
**Product:** FitMap  
**Version:** v1  
**Purpose:** Define the initial product boundaries, target users, value proposition and functional scope of FitMap v1.

This document represents the current product direction and may evolve through reviewed product and architecture decisions.

---

## 1. Product overview

FitMap is a mobile fitness platform designed to connect gym discovery with personal workout planning and progress tracking.

The product aims to reduce the fragmentation currently experienced by users who need different tools to:

- find gyms;
- evaluate available options;
- access relevant information about fitness facilities;
- organize workouts;
- register workout execution;
- monitor personal progress.

FitMap intends to provide these capabilities through a unified mobile experience.

---

## 2. Product vision

FitMap should become a practical and reliable mobile companion for users before, during and after their workouts.

The application is organized around two primary product pillars:

### Discover

Help users find, evaluate and choose gyms according to their location, needs and preferences.

### Train & Progress

Help users structure workouts, register workout execution and follow their training evolution over time.

These pillars should work as parts of the same product rather than as disconnected features.

---

## 3. Target users

FitMap is intended for users with different levels of fitness experience.

### People starting their fitness journey

Users who are looking for a gym and need an accessible way to discover nearby options and understand relevant information about them.

### Active gym users

Users who already train and want to discover other gyms, find locations when travelling or compare available facilities.

### Users who want to organize their training

Users who need a structured way to create workouts, register exercises and maintain a history of their training activity.

### Users interested in progress tracking

Users who want to monitor their consistency and physical or performance evolution through workout history, statistics and optional progress records.

---

## 4. User problems

FitMap aims to address the following problems:

### Gym discovery is fragmented

Users may need to search across maps, websites, social networks and messaging applications to obtain information about gyms.

### Gym information may be difficult to compare

Relevant information such as location, distance, opening hours, contact details, facilities and user feedback may be distributed across different sources.

### Workout organization is often disconnected from gym discovery

Users may locate a gym using one service and manage their workout routine using another unrelated application or manual method.

### Training history can be difficult to maintain consistently

Without structured records, users may lose track of exercises, sets, repetitions, loads and training progression.

### Progress information can become fragmented

Workout history, progress photos, body measurements and performance changes are often stored in different places or not recorded at all.

---

## 5. Value proposition

FitMap combines gym discovery and personal training management in a single mobile product.

The application should allow users to move naturally through a fitness journey such as:

`Discover → Choose → Train → Record → Track progress`

The goal is not only to show gym locations, but to support the user throughout their fitness routine.

---

## 6. Product pillars

### 6.1 Discover

The Discover experience should support:

- current-location-based gym discovery;
- search by location;
- interactive map visualization;
- gym listing;
- distance information;
- gym details;
- route or navigation access;
- filtering and sorting;
- favorite gyms;
- gym comparison where meaningful;
- user reviews and ratings when the required moderation and data model are available.

### 6.2 Train

The Train experience should evolve the prototype's task-based model into a fitness-specific workout model.

The product should support:

- workout creation;
- workout organization;
- exercises associated with workouts;
- sets;
- repetitions;
- load or weight;
- optional notes;
- workout execution records;
- exercise completion records;
- workout history.

### 6.3 Progress

The Progress experience should allow users to understand their evolution over time.

Candidate capabilities include:

- workout history;
- training consistency statistics;
- exercise performance evolution;
- progress photos;
- weight records;
- body measurements;
- goals;
- charts and progress summaries.

The exact v1 scope of advanced progress features will be prioritized according to development cost and product value.

---

## 7. FitMap v1 scope

The product scope is divided into four priority levels.

### 7.1 Core

Core capabilities are required for FitMap to deliver its primary value proposition.

- Real user registration and authentication.
- User profile.
- Current location support.
- Gym search.
- Interactive gym map.
- Gym list.
- Gym detail view.
- Distance information.
- Route or navigation integration.
- Search filters.
- Structured workouts.
- Exercises associated with workouts.
- Sets, repetitions and load registration.
- Workout execution records.
- Workout history.
- Secure data persistence.

### 7.2 Professional

These capabilities are strongly desired for FitMap v1 because they significantly improve product completeness and user experience.

- Favorite gyms.
- Rich gym information.
- Improved search and filtering experience.
- Progress photos.
- Basic training statistics.
- Exercise load progression.
- User preferences.
- Complete loading states.
- Empty states.
- Error states.
- Appropriate permission handling.
- Consistent design system.
- Accessibility considerations.
- Reliable session management.
- Clear feedback for user actions.

### 7.3 Differentiators

These capabilities should be evaluated after the Core and Professional scopes are stable.

- Gym comparison.
- Personal goals.
- Body weight history.
- Body measurements.
- Advanced progress charts.
- Gym ratings.
- Written gym reviews.
- Training reminders and notifications.
- Training consistency indicators.

A differentiator should only be promoted into the active v1 implementation scope when its user value justifies its development and maintenance cost.

### 7.4 Future scope

The following capabilities are intentionally outside the initial FitMap v1 scope unless project conditions change significantly:

- social media feed;
- real-time chat;
- personal trainer marketplace;
- gym membership payments;
- subscription billing;
- complex wearable integrations;
- large-scale social networking features.

These features represent separate product domains or introduce significant technical, operational or regulatory complexity.

---

## 8. Prototype evolution

The existing FitMap application must be treated as a functional prototype rather than as the final product architecture.

Existing functionality should be evaluated according to one of the following decisions:

- preserve;
- improve;
- redesign;
- replace;
- remove.

The prototype currently provides useful validation of the initial product concept, but implementation decisions made for rapid prototyping must not automatically become FitMap v1 architectural decisions.

---

## 9. Workout model evolution

The current task-oriented exercise functionality should evolve into a domain model appropriate for fitness training.

Instead of treating exercises as generic tasks, FitMap should model concepts such as:

- workout;
- workout exercise;
- exercise;
- sets;
- repetitions;
- load;
- workout session;
- exercise execution;
- workout history.

A progress photo should be treated as an optional progress or workout record and should not be the mechanism responsible for determining whether an exercise was completed.

---

## 10. Gym data principles

FitMap must clearly distinguish real external data, FitMap-managed data and demonstration or development data.

Production-facing functionality must not present fabricated information as real information.

Examples include:

- gym prices;
- addresses;
- ratings;
- opening hours;
- contact information;
- facility information.

When information is unavailable, the application should represent it as unavailable instead of generating misleading values.

Gym data handling must follow the approved architecture and external-provider integration strategy.

---

## 11. Product quality principles

FitMap v1 should be developed as a production-oriented software product rather than as an academic prototype.

The product should prioritize:

- usability;
- maintainability;
- security;
- data integrity;
- reliability;
- accessibility;
- performance;
- clear error handling;
- consistent user experience;
- testability;
- technical documentation;
- traceability between requirements and implementation.

Professional quality does not mean maximizing technical complexity.

Technology and architecture decisions should remain proportional to the real product requirements and team capacity.

---

## 12. Scope management

New feature ideas should be evaluated according to:

1. user value;
2. alignment with the FitMap product vision;
3. implementation and maintenance cost;
4. technical risk;
5. impact on the delivery timeline;
6. portfolio and engineering value.

Features should not be added solely because they are technically interesting.

The priority is to deliver a coherent, reliable and complete product before expanding into additional domains.

---

## 13. Success criteria for FitMap v1

FitMap v1 should be considered successful when a user can complete the primary product journey reliably:

1. create an account and authenticate;
2. discover gyms through location or search;
3. inspect useful gym information;
4. select or save relevant gyms;
5. create structured workouts;
6. execute and record training activity;
7. revisit workout history;
8. observe meaningful progress information.

The experience should remain consistent, secure and understandable throughout this journey.

---

## 14. Relationship with the TCC

FitMap is simultaneously a software product and the technical artifact used in the academic final project.

Academic requirements must document and explain the product accurately, but implementation decisions should follow professional software engineering practices rather than being simplified solely for academic presentation.

The technical repository and academic documentation should remain consistent with each other.
