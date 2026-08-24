import type { Metadata } from "next";
import { AdminSubscriptionPlans } from "../../../components/admin/admin-subscription-plans";

export const metadata: Metadata = {
  title: "Manage Subscriptions",
  description: "Edit subscription plans, prices and entitlements.",
  robots: { index: false, follow: false }
};

export default function AdminSubscriptionsPage() {
  return <AdminSubscriptionPlans />;
}
