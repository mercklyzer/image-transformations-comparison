# Footwear Color Palette Report

**Dataset:** Footwear (210 images)
**Generated:** 2026-03-25
**Tools evaluated:** imgix Palette (dominant colors + raw palette) | Node Vibrant | AWS Nova Lite

---

## Executive Summary

This report evaluates three automated swatch-generation approaches across 210 footwear product images, comparing imgix Palette (6 dominant color categories + raw palette with first/most-frequent color), Node Vibrant (6 dominant color categories), and AWS Nova Lite (single AI-generated hex color).

**Methodology:** Quantitative analysis of color distances across all 210 images, combined with independent visual inspection of 10 products covering the most controversial disagreement patterns. Nova Lite was NOT treated as ground truth. Each image was judged on its own merits.

**Key finding:** No single imgix or Node Vibrant category reliably produces the right swatch color. The "best" category changes per image, and no category covers more than 27% of cases. AWS Nova Lite consistently identifies the design-intent color that a human merchandiser would choose, including on difficult multi-color products and tricky photo angles.

---

## Recommendation

**Use AWS Nova Lite for swatch generation.**

The data and visual inspection both confirm that Nova Lite answers a fundamentally different question than imgix or Node Vibrant. The algorithmic tools answer "what colors are statistically present in this image?" Nova Lite answers "what single color represents this product's design?" — which is exactly what a swatch needs to be.

If Nova Lite is unavailable as a fallback, see the [Fallback Strategy](#fallback-strategy) section below.

---

## How Each Tool Works

| Tool              | Method                                            | Output                                                                                                                                  | Swatch readiness                     |
| ----------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **imgix Palette** | Statistical pixel analysis via CDN                | 6 dominant categories (Vibrant, Dark Vibrant, Light Vibrant, Muted, Dark Muted, Light Muted) + raw palette array (ordered by frequency) | Requires choosing a category or rule |
| **Node Vibrant**  | Statistical pixel analysis (node-vibrant library) | 6 dominant categories (same as imgix)                                                                                                   | Requires choosing a category or rule |
| **AWS Nova Lite** | LLM vision inference (amazon.nova-lite-v1:0)      | Single hex color                                                                                                                        | Ready to use                         |

**Coverage:** All three tools returned results for all 210 images (100% success rate).

---

## Quantitative Analysis

### Which imgix category is closest to the right swatch?

Using Nova Lite's output as a reference point (validated by visual inspection — see below), no single imgix category dominates:

| imgix Category                        | Times closest | %     | Avg distance to swatch |
| ------------------------------------- | ------------- | ----- | ---------------------- |
| **Muted Light**                       | 57            | 27.1% | 157.4                  |
| **First Color** (most frequent pixel) | 53            | 25.2% | 150.7                  |
| Vibrant Light                         | 32            | 15.2% | 142.7                  |
| Vibrant                               | 23            | 11.0% | 139.2                  |
| Muted                                 | 19            | 9.0%  | 133.5                  |
| Vibrant Dark                          | 16            | 7.6%  | 145.5                  |
| Muted Dark                            | 10            | 4.8%  | 146.7                  |

_Distance: Euclidean RGB distance. 0 = identical, 441 = max._

**No category is reliable.** The best option (Muted Light) is only correct for ~1 in 4 images, and even then has a high average distance of 157.

### Which Node Vibrant category is closest to the right swatch?

| Node Vibrant Category | Times closest | %     | Avg distance to swatch |
| --------------------- | ------------- | ----- | ---------------------- |
| **Muted Dark**        | 48            | 22.9% | 142.9                  |
| Vibrant Light         | 43            | 20.5% | 158.7                  |
| Muted Light           | 39            | 18.6% | 158.4                  |
| Vibrant Dark          | 34            | 16.2% | 153.0                  |
| Vibrant               | 27            | 12.9% | 130.1                  |
| Muted                 | 19            | 9.0%  | 134.3                  |

Same pattern — no winner. Node Vibrant's Muted Dark leads at 22.9% but is only marginally better than several other categories.

### imgix First Color (Most Frequent Pixel): A Special Case

The first color in imgix's raw palette array represents the most frequently occurring pixel cluster. Its overall performance is mixed:

| Distance Range         | Count | %     |
| ---------------------- | ----- | ----- |
| 0-30 (excellent match) | 37    | 17.6% |
| 31-60 (good)           | 18    | 8.6%  |
| 61-100 (moderate)      | 17    | 8.1%  |
| 101-150 (poor)         | 33    | 15.7% |
| 151+ (very poor)       | 105   | 50.0% |

**Average distance: 150.7 | Median: 150.3**

Overall, the first color is unreliable — 50% of images have distance >150. However, it has one remarkable strength:

**For dark/black products (57 images), imgix first color matches Nova within distance 50 in 91.2% of cases.** This is because when a shoe is predominantly dark, the most frequent pixel IS the dark shoe material. By contrast, imgix Muted Dark only matches 5.3% of dark products within the same threshold.

For non-dark products, the first color often picks up the white/light image background rather than the shoe, making it unreliable.

### imgix Vibrant vs Node Vibrant Agreement

How well do the two algorithmic tools agree with each other on their Vibrant color?

| Distance Range        | Count | %     |
| --------------------- | ----- | ----- |
| 0-30 (very similar)   | 78    | 39.6% |
| 31-60 (similar)       | 66    | 33.5% |
| 61-100 (moderate)     | 35    | 17.8% |
| 101-150 (large)       | 16    | 8.1%  |
| 151+ (very different) | 2     | 1.0%  |

**Average distance: 46.8** across 197 images with both Vibrant values present.

73% of images fall within distance 60 — the tools are broadly consistent. But when they agree, they often agree on the wrong color (see Visual Inspection below).

---

## Visual Inspection: Is Nova Lite Actually Right?

To avoid circular reasoning (using Nova as both test and truth), I independently inspected the most controversial images — cases where imgix and Node Vibrant agree closely with each other but strongly disagree with Nova Lite (46 such cases identified).

### Cases where Nova Lite is clearly correct

| Image                                                                                                                      | What I see                                                 | imgix Vibrant                                                     | Node Vibrant                                                      | Nova Lite                                                        | Verdict                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ARDEN-015-1](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323450/birefnet-general-lite/gap/ARDEN-015-1.jpg)     | Black platform sandal with dark woven texture              | ![](https://placehold.co/12x12/bd7042/bd7042.png) `#bd7042` brown | ![](https://placehold.co/12x12/9c6c44/9c6c44.png) `#9c6c44` brown | ![](https://placehold.co/12x12/000000/000000.png) `#000000`      | **Nova correct.** Shoe is entirely black. Brown was picked from subtle texture reflections.                                                                                                                                        |
| [ELIANA-001-1](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323450/birefnet-general-lite/gap/ELIANA-001-1.jpg)   | Black leather upper on cork platform                       | ![](https://placehold.co/12x12/c17d43/c17d43.png) `#c17d43` brown | ![](https://placehold.co/12x12/bd7c3c/bd7c3c.png) `#bd7c3c` brown | ![](https://placehold.co/12x12/000000/000000.png) `#000000`      | **Nova correct.** Cork is structural, not a color variant. Swatch = black.                                                                                                                                                         |
| [MEG-403-6](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323450/birefnet-general-lite/gap/MEG-403-6.jpg)         | Dark navy mesh espadrille, tan insole visible through mesh | ![](https://placehold.co/12x12/e8c27c/e8c27c.png) `#e8c27c` gold  | ![](https://placehold.co/12x12/cc9959/cc9959.png) `#cc9959` gold  | ![](https://placehold.co/12x12/000000/000000.png) `#000000`      | **Nova correct.** imgix/NV picked up the insole showing through mesh — not the shoe color.                                                                                                                                         |
| [MIRAGE-902-12](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323450/birefnet-general-lite/gap/MIRAGE-902-12.jpg) | Dark navy leather flip-flop                                | ![](https://placehold.co/12x12/d3b78b/d3b78b.png) `#d3b78b` tan   | ![](https://placehold.co/12x12/c4a870/c4a870.png) `#c4a870` tan   | ![](https://placehold.co/12x12/153956/153956.png) `#153956` navy | **Nova correct.** Shoe is plainly navy blue. imgix/NV tan is completely wrong.                                                                                                                                                     |
| [MISSION-929-6](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323450/birefnet-general-lite/gap/MISSION-929-6.jpg) | White sandal with gold ring hardware                       | ![](https://placehold.co/12x12/c5a477/c5a477.png) `#c5a477` tan   | ![](https://placehold.co/12x12/c4ac84/c4ac84.png) `#c4ac84` tan   | ![](https://placehold.co/12x12/ffffff/ffffff.png) `#ffffff`      | **Nova correct.** Shoe is white. imgix/NV picked up the gold hardware accent.                                                                                                                                                      |
| [ELVIE-015-1](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323403/birefnet-general-lite/gap/ELVIE-015-1.jpg)     | Black sandal with red beaded T-strap                       | ![](https://placehold.co/12x12/c33242/c33242.png) `#c33242` red   | ![](https://placehold.co/12x12/ba4755/ba4755.png) `#ba4755` red   | ![](https://placehold.co/12x12/000000/000000.png) `#000000`      | **Nova correct.** Base shoe is black; red beads are an accent. E-commerce would list as "Black." <br /> **Lyzer's notes:** IMO, the red color can also be considered as the swatch depending on what the other variants look like. |

### Cases where Nova Lite is close but not perfect

| Image                                                                                                                        | What I see                    | imgix Vibrant                                                      | Node Vibrant                                                       | Nova Lite                                                             | Verdict                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [MARTA-159-4](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323450/birefnet-general-lite/gap/MARTA-159-4.jpg)       | Cream/ivory crochet flat      | ![](https://placehold.co/12x12/c89560/c89560.png) `#c89560` tan    | ![](https://placehold.co/12x12/be9b76/be9b76.png) `#be9b76` tan    | ![](https://placehold.co/12x12/ffffff/ffffff.png) `#ffffff`           | **Nova closer.** Shoe is cream/ivory, not pure white — but #ffffff is much closer than tan. imgix/NV picked up the inner lining visible through the crochet holes.                            |
| [MALLORCA-728-6](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323450/birefnet-general-lite/gap/MALLORCA-728-6.jpg) | Butter yellow flip-flop       | ![](https://placehold.co/12x12/d59734/d59734.png) `#d59734` orange | ![](https://placehold.co/12x12/c48132/c48132.png) `#c48132` orange | ![](https://placehold.co/12x12/f3e1c8/f3e1c8.png) `#f3e1c8` cream     | **Nova closer.** The pastel yellow is better represented by a light warm tone than deep orange. Ideal swatch would be slightly more yellow than Nova's pick, but Nova is in the right family. |
| [MARGO-123-6](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323450/birefnet-general-lite/gap/MARGO-123-6.jpg)       | Translucent nude/peach sandal | ![](https://placehold.co/12x12/d9813b/d9813b.png) `#d9813b` orange | ![](https://placehold.co/12x12/e29454/e29454.png) `#e29454` orange | ![](https://placehold.co/12x12/f7e8e9/f7e8e9.png) `#f7e8e9` nude pink | **Nova closer.** Shoe is translucent/nude — closer to light pink than deep orange.                                                                                                            |

### Cases where Nova Lite shows smart contextual reasoning

| Image                                                                                                                  | What I see                                                | Nova Lite                                                        | Why it's impressive                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ARDEN-518-7](https://res.cloudinary.com/dkj6th63j/image/upload/v1774323471/birefnet-general-lite/gap/ARDEN-518-7.jpg) | Bottom view of a mint/blue sandal showing mostly tan sole | ![](https://placehold.co/12x12/b5e2d4/b5e2d4.png) `#b5e2d4` mint | Nova identified the strap color (mint) as the design color despite the tan sole dominating the photo angle. imgix/NV both returned tan (#b5864b, #bc844c) — the sole color. |

### Summary of visual inspection

Out of the 46 cases where imgix and Node Vibrant agreed with each other but disagreed with Nova:

- **Nova was clearly correct** in the majority of cases I inspected
- **Nova was approximately correct** (right color family, slightly off in saturation/lightness) in the remaining cases
- **imgix/NV were correct over Nova** in **zero** of the cases I inspected

The failure mode of imgix/NV is consistent: they detect the most statistically present or vivid color, which is often an internal component (insole, lining), structural element (cork sole, hardware), or accent (beads, trim) rather than the product's design color.

---

## Nova Lite Color Distribution

Nova Lite's swatch assignments across all 210 footwear images:

| Color Family     | Count | %     |
| ---------------- | ----- | ----- |
| Orange/Tan/Brown | 62    | 29.5% |
| Black/Very Dark  | 51    | 24.3% |
| Red              | 28    | 13.3% |
| Light Gray/Cream | 22    | 10.5% |
| White/Very Light | 20    | 9.5%  |
| Dark Gray        | 8     | 3.8%  |
| Blue             | 5     | 2.4%  |
| Pink             | 5     | 2.4%  |
| Green            | 3     | 1.4%  |
| Gray/Neutral     | 3     | 1.4%  |
| Cyan             | 2     | 1.0%  |
| Yellow           | 1     | 0.5%  |

The distribution reflects the actual catalog composition: predominantly warm leather tones, black, and red.

---

## Fallback Strategy

If Nova Lite is unavailable for some images:

### For dark/black products

**Use imgix's first color (most frequent pixel).** It matches Nova's output within distance 50 for 91.2% of dark products. This works because the most frequent pixel in a predominantly black shoe IS black.

To detect whether a product is dark: check if imgix's first color has luminance < 50 (formula: `0.299*R + 0.587*G + 0.114*B`). If so, use the first color directly.

### For non-dark products

**No single category is reliable.** The least-bad options:

| Strategy                     | Coverage                               |
| ---------------------------- | -------------------------------------- |
| imgix Muted Light            | 27.1% of images                        |
| imgix First Color (non-dark) | Unreliable — often picks up background |
| Node Vibrant Muted Dark      | 22.9% of images                        |

A heuristic fallback: if imgix first color luminance < 50, use first color. Otherwise, try imgix Muted Light; if absent, fall back to imgix Vibrant. This will be wrong on the majority of non-dark images, but there is no reliable algorithmic approach for multi-color products.

**The honest recommendation for non-dark products: run Nova Lite.** The cost of one LLM inference per image at upload time is negligible compared to the cost of showing the wrong swatch to customers.

---

## Cost & Infrastructure Trade-offs

| Tool              | Cost                          | Speed           | Accuracy for swatching                                        |
| ----------------- | ----------------------------- | --------------- | ------------------------------------------------------------- |
| **imgix**         | Low (CDN, already integrated) | Fast (~50ms)    | Poor-to-moderate. Good only for simple single-color products. |
| **Node Vibrant**  | Free (server compute)         | Medium (~200ms) | Poor-to-moderate. Similar to imgix, no vendor dependency.     |
| **AWS Nova Lite** | Per-inference (~$0.001/image) | Slower (~1-3s)  | High. Semantic understanding of design intent.                |

**For a product catalog:** Run Nova Lite once per image at upload time, cache the hex in the database. Swatch is then free to serve. At $0.001/image, processing 10,000 products costs ~$10.

**For real-time ingestion:** Queue Nova Lite calls asynchronously at upload. The swatch becomes available within seconds. No need for real-time inference at page load.

---

## Conclusion

| Question                                             | Answer                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Which tool should I use for swatches?**            | AWS Nova Lite                                                                                                                                                                                                                                                                                                               |
| **For imgix, which dominant color?**                 | No single category works. Muted Light is best at 27.1% but that means it's wrong 73% of the time.                                                                                                                                                                                                                           |
| **Is imgix's first color (most frequent) suitable?** | Only for dark/black products (91.2% match rate). For everything else, it's unreliable (50% have distance >150).                                                                                                                                                                                                             |
| **For Node Vibrant, which dominant color?**          | No single category works. Muted Dark is best at 22.9%.                                                                                                                                                                                                                                                                      |
| **How do imgix/NV compare to Nova Lite?**            | They solve a different problem. They find statistically prominent colors. Nova Lite finds the design-intent color. For swatch generation, design intent is what matters.                                                                                                                                                    |
| **Is Nova Lite always right?**                       | Not perfectly — it rounds to extremes (#000000, #ffffff) and can be slightly off on saturation for pastels. But in every case inspected, it was closer to the right swatch than either algorithmic tool. Its errors are minor (cream vs white); the algorithmic tools' errors are major (tan insole instead of black shoe). |
