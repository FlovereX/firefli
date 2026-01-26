import Script from 'next/script';

export default function LiveChat() {
  // Set to true and add your script src to enable livechat (customize locally, don't commit)
  const enabled = true;
  const scriptSrc = "https://code.tidio.co/9ql5ypef9wk2tztxqnd972apfmng3hh1.js";

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
