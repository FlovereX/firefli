import Script from 'next/script';

export default function LiveChat() {
  // Set to true and add your script src to enable livechat (customize locally, don't commit)
  const enabled = false;
  const scriptSrc = "";

  if (!enabled || !scriptSrc) {
    return null;
  }

  return (
    <Script
      src={scriptSrc}
      strategy="afterInteractive"
      async
    />
  );
}
