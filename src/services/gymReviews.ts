import { apiClient } from "./apiClient";

interface GymIdentityApiResponse {
  gym_id: string;
  provider_name: string;
  external_id: string;
}

interface GymReviewApiResponse {
  id: string;
  gym_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

interface GymRatingSummaryApiResponse {
  gym_id: string;
  average_rating: string | null;
  review_count: number;
}

interface GymReviewListApiResponse {
  summary: GymRatingSummaryApiResponse;
  reviews: GymReviewApiResponse[];
}

interface GymReviewReportApiResponse {
  id: string;
  review_id: string;
  reason: GymReviewReportReason;
  created_at: string;
}

export interface GymIdentity {
  gymId: string;
  providerName: string;
  externalId: string;
}

export interface GymReview {
  id: string;
  gymId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GymRatingSummary {
  gymId: string;
  averageRating: string | null;
  reviewCount: number;
}

export interface GymReviewList {
  summary: GymRatingSummary;
  reviews: GymReview[];
}

export interface CreateGymReviewInput {
  rating: number;
  comment?: string | null;
}

export interface UpdateGymReviewInput {
  rating?: number;
  comment?: string | null;
}

export type GymReviewReportReason =
  "spam" | "offensive" | "misleading" | "other";

export interface CreateGymReviewReportInput {
  reason: GymReviewReportReason;
  details?: string | null;
}

export interface GymReviewReport {
  id: string;
  reviewId: string;
  reason: GymReviewReportReason;
  createdAt: string;
}

function buildAuthorizationHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function normalizeGymIdentity(response: GymIdentityApiResponse): GymIdentity {
  return {
    gymId: response.gym_id,
    providerName: response.provider_name,
    externalId: response.external_id,
  };
}

function normalizeGymReview(response: GymReviewApiResponse): GymReview {
  return {
    id: response.id,
    gymId: response.gym_id,
    rating: response.rating,
    comment: response.comment,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function normalizeGymRatingSummary(
  response: GymRatingSummaryApiResponse,
): GymRatingSummary {
  return {
    gymId: response.gym_id,
    averageRating: response.average_rating,
    reviewCount: response.review_count,
  };
}

function normalizeGymReviewReport(
  response: GymReviewReportApiResponse,
): GymReviewReport {
  return {
    id: response.id,
    reviewId: response.review_id,
    reason: response.reason,
    createdAt: response.created_at,
  };
}

export async function resolveGymIdentity(
  accessToken: string,
  externalGymId: string,
): Promise<GymIdentity> {
  const encodedExternalId = encodeURIComponent(externalGymId);

  const response = await apiClient.post<GymIdentityApiResponse>(
    `/gyms/${encodedExternalId}/identity`,
    undefined,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeGymIdentity(response);
}

export async function getGymReviews(
  accessToken: string,
  gymId: string,
): Promise<GymReviewList> {
  const encodedGymId = encodeURIComponent(gymId);

  const response = await apiClient.get<GymReviewListApiResponse>(
    `/gyms/${encodedGymId}/reviews`,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return {
    summary: normalizeGymRatingSummary(response.summary),
    reviews: response.reviews.map(normalizeGymReview),
  };
}

export async function getMyGymReview(
  accessToken: string,
  gymId: string,
): Promise<GymReview | null> {
  const encodedGymId = encodeURIComponent(gymId);

  const response = await apiClient.get<GymReviewApiResponse | null>(
    `/gyms/${encodedGymId}/reviews/mine`,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return response === null ? null : normalizeGymReview(response);
}

export async function createGymReview(
  accessToken: string,
  gymId: string,
  input: CreateGymReviewInput,
): Promise<GymReview> {
  const encodedGymId = encodeURIComponent(gymId);

  const response = await apiClient.post<GymReviewApiResponse>(
    `/gyms/${encodedGymId}/reviews`,
    input,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeGymReview(response);
}

export async function updateGymReview(
  accessToken: string,
  reviewId: string,
  input: UpdateGymReviewInput,
): Promise<GymReview> {
  const encodedReviewId = encodeURIComponent(reviewId);

  const response = await apiClient.patch<GymReviewApiResponse>(
    `/gyms/reviews/${encodedReviewId}`,
    input,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeGymReview(response);
}

export async function removeGymReview(
  accessToken: string,
  reviewId: string,
): Promise<void> {
  const encodedReviewId = encodeURIComponent(reviewId);

  await apiClient.delete<void>(`/gyms/reviews/${encodedReviewId}`, {
    headers: buildAuthorizationHeaders(accessToken),
  });
}

export async function reportGymReview(
  accessToken: string,
  reviewId: string,
  input: CreateGymReviewReportInput,
): Promise<GymReviewReport> {
  const encodedReviewId = encodeURIComponent(reviewId);

  const response = await apiClient.post<GymReviewReportApiResponse>(
    `/gyms/reviews/${encodedReviewId}/reports`,
    input,
    {
      headers: buildAuthorizationHeaders(accessToken),
    },
  );

  return normalizeGymReviewReport(response);
}
