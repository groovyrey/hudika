import HomeClient from "@/components/home/home-client";

export const dynamic = "force-dynamic";

export default function Page() {
  const envStatus = {
    hasGemini: Boolean(process.env.GEMINI_API_KEY),
  };

  return <HomeClient envStatus={envStatus} />;
}

