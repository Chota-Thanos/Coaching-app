import { permanentRedirect } from "next/navigation";

export default function CurrentAffairsPage(): never {
  permanentRedirect("/current-affairs/daily-news");
}
