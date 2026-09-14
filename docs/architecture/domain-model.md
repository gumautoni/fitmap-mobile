# FitMap v1 — Domain Model

## Document status

**Status:** Draft  
**Product:** FitMap  
**Version:** v1  
**Related documents:**
- `../requirements/product-scope.md`
- `../requirements/functional-requirements.md`
- `../requirements/non-functional-requirements.md`

This document describes the conceptual domain model of FitMap v1.

The purpose of this model is to define the main business concepts, responsibilities, relationships and invariants before database schemas, API contracts or framework-specific models are designed.

This document intentionally separates domain concepts from implementation details.

---

# 1. Domain model principles

The FitMap domain model should:

- represent concepts that exist in the product problem space;
- preserve clear ownership of user data;
- distinguish planned workouts from executed workouts;
- preserve historical training data even when workout templates change;
- distinguish external gym data from FitMap-managed user data;
- avoid coupling domain rules to mobile UI or database technology;
- support future product evolution without introducing unnecessary complexity.

The domain model is expected to evolve as architecture and user-experience decisions become more precise.

---

# 2. Main domain areas

FitMap currently contains four primary domain areas:

## Identity and Profile

Responsible for the FitMap user and user-specific preferences.

## Gym Discovery

Responsible for gym identity, discovery-related information, favorites and gym-related user interactions.

## Training

Responsible for workout planning, exercises, workout execution and training history.

## Progress

Responsible for user progress records derived from training activity or manually registered progress information.

User-generated gym reviews are related to the Gym Discovery domain but have additional moderation and ownership concerns.

---

# 3. Identity and Profile domain

## User

A `User` represents a person with a FitMap account.

A user owns or controls private product data such as:

- profile information;
- workouts;
- workout sessions;
- progress records;
- progress photos;
- favorite gyms;
- reviews;
- preferences.

Authentication credentials are associated with the user account but their secure representation is an architecture and security concern rather than a domain attribute exposed throughout the product.

### Main responsibilities

- represent the identity of a FitMap account;
- provide ownership boundaries for private data;
- associate user-specific product behavior with the correct account.

### Important rules

- private data must always belong to exactly the correct user;
- one user must never gain access to another user's private records without explicit authorization;
- account deletion must follow the approved personal-data lifecycle.

---

## UserProfile

`UserProfile` represents editable user-facing information associated with a user.

Candidate information may include:

- display name;
- profile image;
- fitness-related preferences.

The final profile attributes will be defined according to actual product needs and privacy considerations.

---

## UserPreferences

`UserPreferences` represents user-specific configuration that changes FitMap behavior without representing independent domain history.

Examples may include:

- fitness preferences;
- notification preferences;
- preferred measurement units;
- application preferences.

The exact preference model will be refined later.

---

# 4. Gym Discovery domain

## Gym

A `Gym` represents a fitness facility that can be discovered or referenced by FitMap.

Conceptually, a gym may contain information such as:

- name;
- geographic location;
- address;
- contact information;
- opening hours;
- images;
- amenities;
- external-provider references.

The existence of the `Gym` domain concept does not yet determine whether every gym will be permanently persisted in the FitMap database.

That persistence strategy will be decided during architecture.

### Important rules

- FitMap must not fabricate production gym information and present it as real data;
- unavailable data must remain explicitly unavailable;
- a gym referenced by FitMap user data must have a stable identity suitable for favorites, reviews and other relationships.

---

## GymExternalReference

`GymExternalReference` conceptually represents the relationship between a FitMap gym identity and an external provider's gym or place identifier.

This concept may become necessary when gym information is obtained from one or more external services.

The final representation will depend on the selected gym-data architecture.

---

## GymAmenity

A `GymAmenity` represents a capability or facility available at a gym.

Examples may include:

- weight-training area;
- cardio equipment;
- group classes;
- parking;
- accessibility-related facilities.

Amenities should only be displayed when supported by trustworthy data.

---

## FavoriteGym

`FavoriteGym` represents the relationship between a user and a gym the user has chosen to save.

### Important rules

- a favorite belongs to one user;
- a favorite references one gym;
- the same gym should not create duplicate favorite relationships for the same user;
- one user's favorites must not affect another user's favorites.

---

# 5. Gym Reviews domain behavior

## GymReview

A `GymReview` represents user-generated feedback associated with a gym.

A review may contain:

- rating;
- written content;
- creation date;
- update date.

### Important rules

- a review must have an identifiable author;
- a review must reference a valid gym identity;
- only the author or an authorized moderation process may modify or remove a review;
- public written reviews require an appropriate moderation and reporting strategy;
- review behavior must not expose private user information unnecessarily.

### Proposed product rule

The initial design should evaluate whether each user may maintain only one active review per gym.

This rule is not yet accepted and must be confirmed before implementation.

---

# 6. Training domain

The training domain distinguishes between:

1. what the user plans to do;
2. what the user actually performs.

This separation is essential for preserving meaningful training history.

---

## Exercise

An `Exercise` represents a type of physical exercise that can be included in a workout.

Examples:

- Barbell Bench Press;
- Squat;
- Lat Pulldown;
- Leg Press.

An exercise may originate from:

- a FitMap-managed exercise catalog;
- a user-created custom exercise.

### Candidate attributes

- name;
- description;
- exercise category;
- target muscle groups;
- equipment requirements;
- ownership or source when the exercise is custom.

The final exercise taxonomy will be defined later.

---

## Workout

A `Workout` represents a reusable training plan created or configured by a user.

Examples:

- Push;
- Pull;
- Legs;
- Chest and Triceps;
- Workout A.

A workout describes planned activity and is not itself proof that training occurred.

### Main responsibilities

- group exercises into a reusable training structure;
- preserve exercise ordering;
- define planned exercise configuration.

### Important rules

- a workout belongs to one user;
- modification of a workout must not corrupt previously completed workout history;
- deleting or archiving a workout must preserve historical sessions that were already completed.

---

## WorkoutExercise

A `WorkoutExercise` represents the inclusion and planned configuration of an exercise inside a workout.

It connects:

`Workout → Exercise`

and may define information such as:

- order;
- target number of sets;
- target repetitions;
- target load when appropriate;
- notes.

`WorkoutExercise` is necessary because the same exercise may have different planned configurations in different workouts.

Example:

```text
Workout A
Bench Press
4 × 8
60 kg