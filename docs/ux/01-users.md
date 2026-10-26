# 01 · Who it's for

> **These are proto-personas** — built from what we know about Indian social
> sellers, not yet from interviews. They tell us what to design for; the
> usability study in [05](05-usability-testing.md) is how we check them.

## The core user

A small clothing seller in India who sells through Instagram and WhatsApp.
Often a woman running the business from home alongside other work; sometimes
a reseller buying from wholesale markets; sometimes a maker (tailor, block
printer, crocheter). Sells 10–200 pieces a month, ₹300–₹3,000 each.

## Three people we design for

### Priya — the home boutique (primary)
*29, Jaipur. Sells cotton kurtis and co-ord sets. 2,400 followers.*

- **Has:** a mid-range Android phone, the bed as a backdrop, an hour at night.
- **Wants:** her kurtis to look as good online as they do in hand; more orders before Diwali.
- **Struggles with:** flat photos don't sell — buyers DM "how does it look on?";
  she can't afford a model shoot; writing captions every day is tiring.
- **Quote we'd expect:** *"Mujhe bas photo achhi chahiye aur caption, baaki main sambhal lungi."*
  ("I just need a good photo and a caption; I'll handle the rest.")
- **Design implication:** the studio has to work from a phone photo of a garment
  on a bed, in under a minute, without her learning anything.

### Imran — the reseller (secondary)
*34, Surat. Buys tees and shirts wholesale, resells on Instagram and Meesho.*

- **Has:** many products, little time per product; price is his main lever.
- **Wants:** to list a new batch fast, with prices and discounts clearly shown.
- **Struggles with:** making 30 posts a week; knowing whether his prices leave any profit.
- **Design implication:** the post maker needs MRP → automatic "% off", remembered
  shop details, and fast repeat use. The research's profit maths matters to him most.

### Meena — the maker (secondary)
*45, Lucknow. Hand-embroidered chikankari. New to selling online; her daughter set up Instagram.*

- **Has:** beautiful work, low confidence with apps, English as a second language.
- **Wants:** to be told what to post and when; to not break anything.
- **Struggles with:** jargon, small text, apps that punish mistakes.
- **Design implication:** plain words, large targets, no dead ends, every error
  explains itself; Hinglish captions; a printable research report she can keep.

## Jobs to be done

| When… | I want to… | So that… |
|---|---|---|
| I have a new piece and only a flat photo | see it worn by a person | buyers can picture it on themselves |
| I'm about to post | put my price, offer and shop name on the photo | buyers don't have to DM to ask |
| I'm writing the post | get a caption and hashtags in the way my buyers talk | I post daily without it taking an hour |
| I'm planning the week | know what to post each day | I stop guessing |
| I'm setting prices | see what I actually earn per piece | I don't sell at a loss in the festive rush |

## Constraints we design around

| Constraint | Consequence in the design |
|---|---|
| **Phone, often one-handed** | 44 px minimum controls; sticky bottom action bar; 16 px inputs so iPhones don't zoom |
| **Patchy mobile data** | Photos are checked in the browser before uploading; a dropped connection can reconnect; the job finishes even if the tab closes |
| **iPhone photos are HEIC** | Detected and explained, with the exact setting to change |
| **Free GPU, a few photos a day** | Results are saved and reused; the cost is stated before every generation |
| **Mixed English and Hindi** | Simple English UI, Hinglish captions. A Hindi interface is the clearest gap (see [07](07-design-critique.md)) |
| **Trust** | Never show a fake result; label anything AI-written; never retype a seller's price |
| **Privacy** | Phone photos carry GPS location — removed before anything leaves the server |
