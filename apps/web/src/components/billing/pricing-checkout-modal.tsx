"use client";

import { useCallback, useState } from "react";
import { X, CheckCircle2, Loader2, CreditCard, ShieldCheck, AlertCircle } from "lucide-react";
import { authenticatedPost } from "../auth/auth-context";

type PlanPrice = {
  id: number;
  currency: string;
  amount_minor: number;
  billing_interval: "one_time" | "month" | "quarter" | "year";
};

type Plan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  prices: PlanPrice[];
};

type Props = {
  plan: Plan;
  selectedPrice: PlanPrice;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
};

const INTERVAL_LABEL: Record<string, string> = {
  one_time: "One-time",
  month: "per month",
  quarter: "per quarter",
  year: "per year"
};

type Step = "confirm" | "processing" | "success" | "error";

export function PricingCheckoutModal({ plan, selectedPrice, token, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("confirm");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const amountINR = (selectedPrice.amount_minor / 100).toFixed(0);

  const handlePurchase = useCallback(async () => {
    setStep("processing");
    setErrorMsg(null);

    try {
      // Step 1: Create order
      const order = await authenticatedPost<{
        order_id: string;
        currency: string;
        amount: number;
        key_id: string;
        plan_name: string;
        simulated: boolean;
      }>("/api/v1/billing/orders", token, { plan_price_id: selectedPrice.id });

      if (order.simulated) {
        // Simulated payment flow (no real Razorpay)
        const verifyResult = await authenticatedPost<{ subscription: unknown; plan_name: string }>(
          "/api/v1/billing/verify",
          token,
          {
            razorpay_order_id: order.order_id,
            razorpay_payment_id: `sim_pay_${Date.now()}`,
            razorpay_signature: "simulated_signature",
            plan_price_id: selectedPrice.id
          }
        );
        if (verifyResult.subscription) {
          setStep("success");
          setTimeout(() => onSuccess(), 2000);
        }
      } else {
        // Real Razorpay checkout
        const rzp = new (window as any).Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: "CoachingHub",
          description: plan.name,
          order_id: order.order_id,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            const verifyResult = await authenticatedPost<{ subscription: unknown }>(
              "/api/v1/billing/verify",
              token,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_price_id: selectedPrice.id
              }
            );
            if (verifyResult.subscription) {
              setStep("success");
              setTimeout(() => onSuccess(), 2000);
            }
          },
          modal: {
            ondismiss: () => {
              setStep("confirm");
            }
          },
          prefill: {},
          theme: { color: "#4f46e5" }
        });
        rzp.open();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Payment failed. Please try again.");
      setStep("error");
    }
  }, [plan, selectedPrice, token, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={step !== "processing" ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-7 pt-7 pb-8 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Subscribe</p>
              <h2 className="text-2xl font-black tracking-tight">{plan.name}</h2>
              {plan.description && (
                <p className="text-indigo-200 text-sm mt-2 leading-relaxed max-w-xs">{plan.description}</p>
              )}
            </div>
            {step !== "processing" && (
              <button
                onClick={onClose}
                className="ml-4 -mt-1 grid h-8 w-8 place-items-center rounded-full bg-white/10 hover:bg-white/20 transition text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Price Badge */}
          <div className="mt-6 inline-flex items-baseline gap-1 rounded-2xl bg-white/15 px-5 py-3">
            <span className="text-lg font-bold text-indigo-100">₹</span>
            <span className="text-4xl font-black text-white">{amountINR}</span>
            <span className="text-indigo-200 text-sm font-semibold ml-1">
              {INTERVAL_LABEL[selectedPrice.billing_interval]}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-7 py-6">
          {step === "confirm" && (
            <>
              {/* Trust signals */}
              <div className="flex items-center gap-2 mb-6 text-xs font-semibold text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span>Secure payment powered by Razorpay · 256-bit SSL encryption</span>
              </div>

              {/* Order summary */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 mb-6 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-semibold">Plan</span>
                  <span className="font-bold text-slate-800">{plan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-semibold">Billing</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {selectedPrice.billing_interval === "one_time" ? "One-time purchase" : INTERVAL_LABEL[selectedPrice.billing_interval]}
                  </span>
                </div>
                <div className="border-t border-slate-200 my-1" />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700 font-black">Total</span>
                  <span className="font-black text-indigo-700 text-base">₹{amountINR}</span>
                </div>
              </div>

              <button
                onClick={handlePurchase}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-black text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300"
              >
                <CreditCard className="h-4 w-4" />
                Proceed to Payment
              </button>
              <p className="text-center text-xs text-slate-400 font-semibold mt-3">
                Cancel anytime · No hidden fees
              </p>
            </>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mb-4" />
              <h3 className="text-lg font-black text-slate-800">Processing Payment</h3>
              <p className="text-sm text-slate-500 mt-1.5">Please wait while we securely process your payment...</p>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4 ring-4 ring-emerald-100">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Subscription Active!</h3>
              <p className="text-sm text-slate-500 mt-2 max-w-xs">
                Your <strong>{plan.name}</strong> subscription is now active. Enjoy full access!
              </p>
              <p className="text-xs text-slate-400 font-semibold mt-4">Redirecting you shortly...</p>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="h-14 w-14 rounded-full bg-rose-50 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-rose-500" />
              </div>
              <h3 className="text-lg font-black text-slate-800">Payment Failed</h3>
              <p className="text-sm text-slate-500 mt-1.5 max-w-xs">
                {errorMsg ?? "Something went wrong. Please try again."}
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep("confirm")}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
