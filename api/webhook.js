export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot en ligne.");
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHANNEL_ID = process.env.CHANNEL_ID;

  const message = req.body.message;
  if (!message || !message.text) {
    return res.status(200).send("ok");
  }

  const text = message.text.trim();
  const chatId = message.chat.id;

  if (text.startsWith("/start")) {
    await sendTelegramMessage(BOT_TOKEN, chatId,
      "Salut ! Envoie-moi :\n/post <lien> [prix] [code_promo] [lien_coupon] [titre]\net je poste le produit dans le canal.");
    return res.status(200).send("ok");
  }

  if (text.startsWith("/post")) {
    const parts = text.split(" ").filter(Boolean);
    const lien = parts[1];
    const prixManuel = parts[2];
    const code = parts[3];
    const coupon = parts[4];
    const titreManuel = parts.slice(5).join(" ");

    if (!lien) {
      await sendTelegramMessage(BOT_TOKEN, chatId,
        "Usage : /post <lien> [prix] [code_promo] [lien_coupon] [titre]");
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
    const image = infos.image;

    const texteMessage = formaterMessage(titre, prix, lien, code, coupon);

    try {
      if (image) {
        await sendTelegramPhoto(BOT_TOKEN, CHANNEL_ID, image, texteMessage);
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

    const titreMatch = html.match(/<title>([^<]+)<\/title>/i);

    return {
      titre: getMeta("og:title") || (titreMatch ? titreMatch[1].trim() : null),
      image: getMeta("og:image"),
      prix: getMeta("product:price:amount") || getMeta("og:price:amount"),
    };
  } catch (e) {
    return { titre: null, image: null, prix: null };
  }
}

function formaterMessage(titre, prix, lien, code, coupon) {
  let lignes = [`🔍 ${titre}`];
  if (prix) lignes.push(`💸 Prix : ${prix}`);
  lignes.push(`🔗 Lien : ${lien}`);
  if (code) lignes.push(`💻 Code : ${code}`);
  if (coupon) lignes.push(`🌍 -60% coupons : ${coupon}`);
  return lignes.join("\n");
}

async function sendTelegramMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendTelegramPhoto(token, chatId, photoUrl, caption) {
  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  });
}
