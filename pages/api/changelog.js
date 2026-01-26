import Parser from "rss-parser";

export default async function handler(req, res) {
	const FEED_URL = "https://cl.firefli.net/changelog/cmkvbgjd2001888v9k9z2bs8f/rss.xml";
	try {
		const parser = new Parser();
		const feed = await parser.parseURL(FEED_URL);
		const items = (feed.items || []).map((item) => ({
			title: item.title || "",
			pubDate: item.pubDate || item.isoDate || "",
			content: item["content:encoded"] || item.content || "",
		}));

		const metaMode = req.query && (req.query.meta === "1" || req.query.meta === "true");
		res.setHeader("Content-Type", "application/json");
		if (metaMode) {
			const channel = {
				title: feed.title || "",
				description: feed.description || "",
				lastBuildDate: feed.lastBuildDate || "",
			};
			return res.status(200).json({ channel, items });
		}
		return res.status(200).json(items);
	} catch (err) {
		const metaMode = req.query && (req.query.meta === "1" || req.query.meta === "true");
		res.setHeader("Content-Type", "application/json");
		if (metaMode) return res.status(200).json({ channel: null, items: [] });
		return res.status(200).json([]);
	}
}