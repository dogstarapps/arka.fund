import {
  formatExecutionVenueConfirmationModelLabel,
  formatExecutionVenueFamilyLabel,
  formatExecutionVenuePathModelLabel,
  type ExecutionVenueConfirmationModel,
  type ExecutionVenueDescriptor,
  type ExecutionVenueFamily,
  type ExecutionVenueId,
  type ExecutionVenuePathModel,
} from "@/lib/workflows/executionVenues";
import type {
  RebalanceRouteCandidate,
  RebalanceSplitRoutePlan,
} from "@/lib/workflows/rebalanceRouting";

export interface ExecutionReceiptStep {
  id: string;
  label: string;
  hash: string;
}

export interface ExecutionReceipt {
  venueId: ExecutionVenueId;
  venueTitle: string;
  venueFamily: ExecutionVenueFamily;
  pathModel: ExecutionVenuePathModel;
  confirmationModel: ExecutionVenueConfirmationModel;
  actionLabel: string;
  summary: string;
  detail: string;
  primaryHash: string;
  submittedAt: string;
  steps: ExecutionReceiptStep[];
}

export function buildRebalanceExecutionReceipt(input: {
  candidate: RebalanceRouteCandidate;
  primaryHash: string;
  actionLabel: string;
  steps: ExecutionReceiptStep[];
  submittedAt?: string;
}): ExecutionReceipt {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  return {
    venueId: input.candidate.protocol,
    venueTitle: input.candidate.title,
    venueFamily: input.candidate.venueFamily,
    pathModel: input.candidate.pathModel,
    confirmationModel: input.candidate.confirmationModel,
    actionLabel: input.actionLabel,
    primaryHash: input.primaryHash,
    submittedAt,
    steps: input.steps,
    summary: `${input.candidate.title} confirmed through ${formatExecutionVenueFamilyLabel(input.candidate.venueFamily)} using ${formatExecutionVenuePathModelLabel(input.candidate.pathModel)}.`,
    detail: `Confirmation model: ${formatExecutionVenueConfirmationModelLabel(input.candidate.confirmationModel)}.`,
  };
}

export function buildSplitRebalanceExecutionReceipt(input: {
  splitRoute: RebalanceSplitRoutePlan;
  primaryHash: string;
  actionLabel: string;
  steps: ExecutionReceiptStep[];
  submittedAt?: string;
}): ExecutionReceipt {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  return {
    venueId: "SPLIT_ROUTE",
    venueTitle: "Split-route best execution",
    venueFamily: "amm_router",
    pathModel: "router_multi_hop",
    confirmationModel: "transaction_hash_plus_refresh",
    actionLabel: input.actionLabel,
    primaryHash: input.primaryHash,
    submittedAt,
    steps: input.steps,
    summary: `Split-route execution confirmed across ${input.splitRoute.allocationCount.toLocaleString()} AMM allocations.`,
    detail: `Estimated output ${input.splitRoute.totalEstimatedOutBase.toLocaleString()} with ${input.splitRoute.estimatedImprovementBase.toLocaleString()} improvement over the best single route.`,
  };
}

export function buildExecutionVenueReceipt(input: {
  venue: ExecutionVenueDescriptor;
  actionLabel: string;
  primaryHash: string;
  steps: ExecutionReceiptStep[];
  submittedAt?: string;
}): ExecutionReceipt {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  return {
    venueId: input.venue.id,
    venueTitle: input.venue.title,
    venueFamily: input.venue.family,
    pathModel: input.venue.pathModel,
    confirmationModel: input.venue.confirmationModel,
    actionLabel: input.actionLabel,
    primaryHash: input.primaryHash,
    submittedAt,
    steps: input.steps,
    summary: `${input.venue.title} execution confirmed through ${formatExecutionVenueFamilyLabel(input.venue.family)} using ${formatExecutionVenuePathModelLabel(input.venue.pathModel)}.`,
    detail: input.venue.confirmationDetail,
  };
}
