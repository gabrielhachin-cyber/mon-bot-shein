export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot en ligne.");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHANNEL_ID = process.env.CHANNEL_ID;

  const LIEN_COUPON_FIXE = "https://onelink.shein.com/49/5zmbn9et0oec";

  const message = req.body.message;
  if (!message || !message.text) {
    return res.status(200).send("ok");
  }

  const text = message.text.trim();
  const chatId = message.chat.id;

  if (text.startsWith("/start")) {
    await sendTelegramMessage(BOT_TOKEN, chatId,
      "Salut ! Envoie-moi :\n/post <lien> [prix] [code_promo] [titre]\net je poste le produit dans le canal.");
    return res.status(200).send("ok");
  }

  if (text.startsWith("/post")) {
    const parts = text.split(" ").filter(Boolean);
    const lien = parts[1];
    const prixManuel = parts[2];
    const code = parts[3];
    const titreManuel = parts.slice(4).join(" ");

    if (!lien) {
      await sendTelegramMessage(BOT_TOKEN, chatId,
        "Usage : /post <lien> [prix] [code_promo] [titre]");
      return res.status(200).send("ok");
    }

    await sendTelegramMessage(BOT_TOKEN, chatId, "⏳ Récupération des infos du produit...");

    const infos = await extraireInfosProduit(lien);
    let titre;
    if (titreManuel) {
      titre = titreManuel;
    } else {
      titre = infos.titre || "Produit";
      titre = titre.split(",")[0].trim();
      if (titre.length > 70) titre = titre.slice(0, 70).trim() + "...";
    }
    const prix = prixManuel || infos.prix || "Voir sur le site";
    const images = infos.images;

    const texteMessage = formaterMessage(titre, prix, lien, code, LIEN_COUPON_FIXE);

    try {
      if (images.length >= 2) {
        await sendTelegramMediaGroup(BOT_TOKEN, CHANNEL_ID, images.slice(0, 2), texteMessage);
      } else if (images.length === 1) {
        await sendTelegramPhoto(BOT_TOKEN, CHANNEL_ID, images[0], texteMessage);
      } else {
        await sendTelegramMessage(BOT_TOKEN, CHANNEL_ID, texteMessage);
      }
      await sendTelegramMessage(BOT_TOKEN, chatId, "✅ Posté dans le canal.");
    } catch (e) {
      await sendTelegramMessage(BOT_TOKEN, chatId, "❌ Erreur lors de la publication : " + e.message);
    }
  }

  return res.status(200).send("ok");
}

async function extraireInfosProduit(lien) {
  try {
    const r = await fetch(lien, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProductBot/1.0)" },
    });
    const html = await r.text();

    const getMeta = (prop) => {
      const regex = new RegExp(
        `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
        "i"
      );
      const match = html.match(regex);
      return match ? match[1].trim() : null;
    };

    const getAllImages = () => {
      const regex = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
      const results = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        results.push(match[1].trim());
      }
      return results;
    };

    const titreMatch = html.match(/<title>([^<]+)<\/title>/i);

    return {
      titre: getMeta("og:title") || (titreMatch ? titreMatch[1].trim() : null),
      images: getAllImages(),
      prix: getMeta("product:price:amount") || getMeta("og:price:amount"),
    };
  } catch (e) {
    return { titre: null, images: [], prix: null };
