import os
import re
import logging
import requests
from bs4 import BeautifulSoup
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ====== CONFIGURATION ======
BOT_TOKEN = os.getenv("BOT_TOKEN", "TON_TOKEN_ICI")
CHANNEL_ID = os.getenv("CHANNEL_ID", "@ton_canal")
# ============================


def extraire_infos_produit(lien: str) -> dict:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ProductBot/1.0)"}
    try:
        r = requests.get(lien, headers=headers, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        def meta(prop):
            tag = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
            return tag["content"].strip() if tag and tag.get("content") else None

        titre = meta("og:title") or (soup.title.string.strip() if soup.title else "Produit")
        image = meta("og:image")
        prix = meta("product:price:amount") or meta("og:price:amount")

        return {"titre": titre, "image": image, "prix": prix}
    except Exception as e:
        logger.warning(f"Impossible d'extraire les infos de {lien}: {e}")
        return {"titre": None, "image": None, "prix": None}


def formater_message(titre: str, prix: str, lien: str, code: str = None) -> str:
    lignes = [f"🔍 {titre}"]
    if prix:
        lignes.append(f"💸 Prix : {prix}")
    lignes.append(f"🔗 Lien : {lien}")
    if code:
        lignes.append(f"💻 Code : {code}")
    return "\n".join(lignes)


async def post(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text(
            "Usage : /post <lien> [prix] [code_promo]\n"
            "Exemple : /post https://exemple.com/produit 52,04€ G3Z7989"
        )
        return

    lien = args[0]
    prix_manuel = args[1] if len(args) > 1 else None
    code = args[2] if len(args) > 2 else None

    await update.message.reply_text("⏳ Récupération des infos du produit...")

    infos = extraire_infos_produit(lien)
    titre = infos["titre"] or "Produit"
    prix = prix_manuel or infos["prix"] or "Voir sur le site"
    image = infos["image"]

    message = formater_message(titre, prix, lien, code)

    try:
        if image:
            await context.bot.send_photo(chat_id=CHANNEL_ID, photo=image, caption=message)
        else:
            await context.bot.send_message(chat_id=CHANNEL_ID, text=message)
        await update.message.reply_text("✅ Posté dans le canal.")
    except Exception as e:
        await update.message.reply_text(f"❌ Erreur lors de la publication : {e}")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Salut ! Envoie-moi /post <lien> [prix] [code_promo] et je poste le produit "
        "dans le canal configuré."
    )


def main():
    if BOT_TOKEN == "TON_TOKEN_ICI":
        print("⚠️  Configure BOT_TOKEN et CHANNEL_ID.")
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("post", post))
    print("Bot lancé...")
    app.run_polling()


if __name__ == "__main__":
    main()
