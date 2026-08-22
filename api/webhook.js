export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot en ligne.");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHANNEL_ID = process.env.CHANNEL_ID;

  // Lien de coupon fixe, ajouté automatiquement à chaque post
  const LIEN_COUPON_FIXE = "https://onelink.shein.com/49/5zmbn9et0oec";

  const message = req.body.message;
  if (!message || !message.
