#!/usr/bin/env python3
"""v37 "THE WORLD / THE LAYER" -- graphics kit: a bright editorial
transformation grammar. Its own visual language (daylight footage, one
coral accent, directional wipes) -- not v33's premium HUD, not v34's
paper panels, not v35's plain white-on-real-footage minimalism, not
v36's dark technical field.

fade_k carries v35/v36's own corrected formula from the start: a
genuine no_out flag that skips the release multiplier entirely (out_margin
alone does not hold opacity at 1.0 through the true last frame -- the
release ease always completes exactly at t=dur). Not re-discovered here,
reused because it is already known-correct.

Every font size below already starts at r184's own stated minimum
(primary labels 72px+, captions 52px+, disclosures/secondary 38px+) --
v36 needed three review rounds to reach its own late-supplied minimums;
this style gives them to itself on the first pass.

Type treatment, r189: every text element used to sit inside a hard-edged
solid-fill rectangle -- a chyron/lower-third convention, not how a
premium product film ever sets type, and the reason a from-scratch
critical look at the delivered film reads as a corporate explainer
rather than an Apple-tier reveal. Replaced everywhere with soft,
feathered scrims (blurred alpha, no hard edge) and blurred-halo text
(a dark blurred duplicate of the glyphs sits behind the crisp glyphs,
the standard broadcast-safe legibility technique that doesn't need a
box). Blur operations are sized to the text's own bounding box, not the
full 1920x1080 frame, so this costs less per frame than the boxes did,
not more. Only two primary labels (the hook's "THE WORLD"/"THE LAYER"
toggle) still render in the reserved coral -- every other beat's label
is clean white, so the accent reads as a rare event again instead of
a wash of red on every single frame.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

_FDIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                      "fonts", "inter", "extras", "ttf")

W, H = 1920, 1080

ACCENT = (235, 66, 58)           # coral-red, RGB -- the ONE saturated
                                  # accent: wipe seams, zone-trace
                                  # brackets, the anchor pulse, the
                                  # hook's own title toggle, and small
                                  # rule/sub-caption accents. Reserved
                                  # deliberately rare elsewhere so it
                                  # reads as a designed accent, not a
                                  # dominant screen color.
OFFWHITE = (245, 246, 248)
DARKSCRIM = (10, 10, 12)

_FONT_CACHE = {}


def font(weight, sz):
    key = (weight, sz)
    if key not in _FONT_CACHE:
        _FONT_CACHE[key] = ImageFont.truetype(f"{_FDIR}/Inter-{weight}.ttf", sz)
    return _FONT_CACHE[key]


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def fade_k(t, dur, in_t=0.35, out_margin=0.4, no_out=False):
    """no_out=True skips the release multiplier entirely -- v35/v36's own
    finding, carried in from the start: zeroing out_margin alone still
    ramps to ~2.5% opacity one frame before the end, because the release
    ease always completes exactly at t=dur regardless of out_margin."""
    k = ease(min(1.0, t / in_t)) if in_t > 0 else 1.0
    if not no_out:
        k *= ease(min(1.0, max(0.0, (dur - out_margin - t) / 0.35)))
    return k


def _shadow_text(d, xy, s, f, fill, anchor="la"):
    x, y = xy
    d.text((x + 1, y + 1), s, font=f, fill=(0, 0, 0, min(255, int(fill[3] * 0.6)) if len(fill) > 3 else 140), anchor=anchor)
    d.text((x, y), s, font=f, fill=fill, anchor=anchor)


def _soft_patch_scrim(img, cx, cy, half_w, half_h, max_alpha=150, blur=46, color=DARKSCRIM):
    """A feathered dark patch behind a text block -- replaces a hard
    rectangle with a soft-edged gradient (blur op sized to the patch
    itself, not the full frame, so this is cheap)."""
    if max_alpha <= 0:
        return
    half_w, half_h, blur = int(half_w), int(half_h), max(1, int(blur))
    pad = int(blur * 2.2) + 8
    bw, bh = int(2 * half_w + 2 * pad), int(2 * half_h + 2 * pad)
    layer_l = Image.new("L", (bw, bh), 0)
    ld = ImageDraw.Draw(layer_l)
    ld.rectangle([pad, pad, bw - pad, bh - pad], fill=max_alpha)
    layer_l = layer_l.filter(ImageFilter.GaussianBlur(blur))
    scrim = Image.new("RGBA", (bw, bh), color + (0,))
    scrim.putalpha(layer_l)
    img.alpha_composite(scrim, (int(cx - bw / 2), int(cy - bh / 2)))


def _edge_scrim(img, edge, band_frac, max_alpha=175, color=DARKSCRIM, ease_pow=1.0):
    """A smooth gradient along one frame edge (real captioning's own
    device) -- no blur needed, the ramp is already continuous.
    ease_pow<1.0 front-loads the rise (frac**ease_pow) so the band is
    already near max_alpha by the time it reaches a caption's actual
    y-position instead of only partway up a strictly linear ramp --
    r190's own finding: at the old linear ramp, text sitting well above
    the band's very bottom edge sat behind only ~60% of the nominal
    peak opacity, not the full value."""
    if max_alpha <= 0:
        return
    band_h = int(H * band_frac)
    frac = np.linspace(0.0, 1.0, band_h) ** ease_pow
    ramp = (frac * max_alpha).astype(np.uint8)
    if edge == "bottom":
        alpha = np.tile(ramp.reshape(band_h, 1), (1, W))
        pos = (0, H - band_h)
    elif edge == "top":
        alpha = np.tile(ramp[::-1].reshape(band_h, 1), (1, W))
        pos = (0, 0)
    else:
        raise ValueError(edge)
    scrim = Image.new("RGBA", (W, band_h), color + (0,))
    scrim.putalpha(Image.fromarray(alpha, mode="L"))
    img.alpha_composite(scrim, pos)


def _halo_text(img, xy, s, f, fill, anchor="mm", halo_alpha=170, blur=6,
               keyline_alpha=0, keyline_width=2):
    """Crisp text over a soft blurred dark duplicate of itself -- the
    legibility a box gave, without the box. Only supports anchor="mm"
    (everything this style needs); blur is sized to the glyphs' own
    bounding box, not the full frame. keyline_alpha>0 adds a crisp dark
    stroke around the glyphs UNDER the soft halo (r190/r191: pale sky,
    snow and bright concrete washed out plain white type -- the wide
    soft halo alone wasn't enough contrast; a tight stroke plus the
    halo gives both a soft glow and a hard edge)."""
    x, y = xy
    d0 = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    bbox = d0.textbbox((0, 0), s, font=f, anchor="la")
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = blur * 3 + 12
    bw, bh = int(tw + 2 * pad), int(th + 2 * pad)
    if halo_alpha > 0:
        layer = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.text((bw / 2, bh / 2), s, font=f, fill=(0, 0, 0, halo_alpha), anchor="mm")
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
        img.alpha_composite(layer, (int(x - bw / 2), int(y - bh / 2)))
    d = ImageDraw.Draw(img, "RGBA")
    if keyline_alpha > 0:
        d.text(xy, s, font=f, fill=fill, anchor=anchor,
               stroke_width=keyline_width, stroke_fill=(0, 0, 0, keyline_alpha))
    else:
        _shadow_text(d, xy, s, f, fill, anchor=anchor)


def _draw_tracked(img, x, y, s, f, fill, tracking=4, halo_alpha=170, blur=5,
                   keyline_alpha=0, keyline_width=2):
    """Left-anchored text with manual letter-spacing -- the small-caps,
    generously tracked treatment real disclosure/credit type uses,
    instead of PIL's default cramped kerning. Returns the tracked width
    so callers can right-align. keyline_alpha>0 adds a crisp dark
    stroke per glyph under the soft halo (see _halo_text)."""
    d = ImageDraw.Draw(img, "RGBA")
    widths = [d.textlength(ch, font=f) for ch in s]
    total = sum(widths) + tracking * (len(s) - 1) if s else 0
    if not s:
        return 0
    bbox = d.textbbox((0, 0), "Hg", font=f, anchor="la")
    th = bbox[3] - bbox[1]
    pad = blur * 3 + 12
    bw, bh = int(total + 2 * pad), int(th + 2 * pad)
    if halo_alpha > 0:
        layer = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        cx = pad
        for ch, w in zip(s, widths):
            ld.text((cx, pad), ch, font=f, fill=(0, 0, 0, halo_alpha), anchor="la")
            cx += w + tracking
        layer = layer.filter(ImageFilter.GaussianBlur(blur))
        img.alpha_composite(layer, (int(x - pad), int(y - pad)))
    d = ImageDraw.Draw(img, "RGBA")
    cx = x
    for ch, w in zip(s, widths):
        if keyline_alpha > 0:
            d.text((cx, y), ch, font=f, fill=fill, anchor="la",
                   stroke_width=keyline_width, stroke_fill=(0, 0, 0, keyline_alpha))
        else:
            _shadow_text(d, (cx, y), ch, f, fill, anchor="la")
        cx += w + tracking
    return total


def full_bleed(content_rgb_float):
    """Edge-to-edge real footage -- every overlay in this style is drawn
    ON TOP of this by the caller, never masked into it. content_rgb_float
    is a BGR float array (the pipeline's own convention, matching
    ffmpeg's rawvideo bgr24 output)."""
    return Image.fromarray(np.clip(content_rgb_float, 0, 255).astype(np.uint8)[:, :, ::-1]).convert("RGBA")


# The same AR-window geometry recognize's own zone_trace/anchor_pulse
# already use (ZONE_CX/ZONE_CY/ZONE_W/ZONE_H in render_layer.py) --
# reused here on purpose so every windowed reveal in the film sits in
# the same place, reading as one consistent AR system, not a different
# effect per section.
WIN_CX_FRAC, WIN_CY_FRAC = 560 / W, 460 / H
WIN_W_FRAC, WIN_H_FRAC = 760 / W, 400 / H


def windowed_reveal(world_bgr, layer_bgr, progress, direction="ltr",
                     win_cx=WIN_CX_FRAC, win_cy=WIN_CY_FRAC,
                     win_w=WIN_W_FRAC, win_h=WIN_H_FRAC,
                     shrink_brackets=False):
    """r196 (operator direct note): every prior reveal in this style
    was a FULL-FRAME wipe -- the whole picture swapped to an unrelated
    photo (a different place, a different person, sometimes a black
    studio void), which is exactly backwards from what an AR-glasses
    film is supposed to feel like: "you walk around with glasses and
    you see stuff," meaning the real place NEVER disappears -- the
    visualization appears as a bounded window within your continuous
    view. This function replaces the old wipe_reveal() everywhere in
    the film (hook, borrow, examples_hist, examples_ice -- see
    render_layer.py); wipe_reveal itself is deleted, having zero
    callers left. The real footage stays full-bleed at EVERY value of
    progress; the transformed/AI/product content only ever appears
    inside a floating AR window, framed with the exact same corner
    brackets zone_trace already uses for recognize's own bounded zone,
    so the whole film reads as one consistent AR system rather than a
    different visual effect in every section.

    progress 0.0 = window empty/absent; 1.0 = window fully revealed.
    The reveal sweeps in `direction`, but confined to the window's own
    bounds -- never the full frame. Both inputs are the same HxWx3 BGR
    arrays every other function here takes (uint8 or float).

    shrink_brackets=True (r201, off by default -- every other call in
    the film is unaffected): the corner brackets track the ACTUAL
    revealed-content bounds instead of the full fixed window rect, so
    they shrink/grow together with the content rather than fading
    opacity around empty space. render_layer.py passes this only
    during borrow's own closing sweep (see build_borrow)."""
    img = full_bleed(world_bgr)
    if progress <= 0.0:
        return img
    Wf, Hf = img.width, img.height
    ww, wh = int(win_w * Wf), int(win_h * Hf)
    wx = max(0, min(Wf - ww, int(win_cx * Wf - ww / 2)))
    wy = max(0, min(Hf - wh, int(win_cy * Hf - wh / 2)))
    p = min(1.0, progress)

    # r198 (ChatGPT review): the wider, offset, higher-alpha scrim read as
    # a floating picture-card's drop shadow, working against "an anchored
    # AR layer." Tighter to the window bounds, centered (no offset), and
    # much lower alpha -- a legibility scrim only; the corner brackets
    # below carry the AR-system identity, not a shadow.
    _soft_patch_scrim(img, wx + ww / 2, wy + wh / 2, ww / 2 + 6, wh / 2 + 6,
                       max_alpha=int(60 * min(1.0, p * 3)), blur=16)

    layer_img = full_bleed(layer_bgr)
    lw, lh = layer_img.width, layer_img.height
    target_ar, src_ar = ww / wh, lw / lh
    if src_ar > target_ar:
        new_w = max(1, int(lh * target_ar))
        x0 = (lw - new_w) // 2
        crop = layer_img.crop((x0, 0, x0 + new_w, lh))
    else:
        new_h = max(1, int(lw / target_ar))
        y0 = (lh - new_h) // 2
        crop = layer_img.crop((0, y0, lw, y0 + new_h))
    crop = crop.resize((ww, wh), Image.LANCZOS)

    # r214 (operator direct note, AGAIN, after r211's fixes shipped:
    # "that's not a seamless overlay"): every prior fix (r197 window,
    # r201 feather/rim, r211 opacity-cap/cool-tint/scanlines) treated
    # this as an edge-thinness or opacity problem. Looking at the actual
    # delivered frame, it wasn't -- two bigger things neither prior fix
    # touched:
    #  (a) r211's own "cool digital" push deliberately pushed the insert
    #      AWAY from the real scene's color -- on a bright sunlit real
    #      photo that makes the insert visibly a different, colder
    #      photograph dropped on top, the opposite of "seamless."
    #  (b) the edge was still a near-linear 5%-wide ramp (not a real
    #      soft blend) with a bright corner-bracket HUD held at nearly
    #      full opacity for the ENTIRE hold, not just the reveal -- a
    #      picture frame that never stops announcing itself as a frame.
    # Replaced with two real fixes, both in this one function so every
    # call site gets them at once:
    #  (1) grade the insert toward the REAL scene's own sampled ambient
    #      color (a ring of real pixels just outside the window),
    #      instead of a fixed synthetic push -- the insert now sits in
    #      the same light as the photo around it.
    #  (2) a genuinely wide, gaussian-blurred alpha falloff (no crisp
    #      rectangle edge at any zoom) instead of a thin linear ramp;
    #      brackets/rim are capped well short of full strength (see
    #      below) so they read as a brief focusing cue, not a sustained
    #      frame around the picture.
    # r215 (operator, again, on the r214 delivery: measured the actual
    # rendered pixels rather than trusting the fix -- the box's own sky
    # was ~14 values BRIGHTER than the real sky directly above it, and
    # ~25-30 darker than the real sky beside it: a real, measurable
    # color mismatch, not a perception problem). The bug: the r214
    # ambient sample averaged a ring around ALL FOUR sides of the
    # window, including the band BELOW it -- which for every current
    # call site is the real railing (dark green/black), not sky. That
    # contaminated the "ambient" target with non-sky pixels, so the
    # correction pulled toward a muddy, inconsistent average instead of
    # the clean sky actually visible next to the box. Also, comparing
    # the correction to the CROP'S OWN full-frame mean (sky + mammoths +
    # trees + city all mixed together) compared two different kinds of
    # average, not sky-to-sky.
    # Fixed: ambient sampled ONLY from the band directly ABOVE the
    # window (reliably clean sky at every call site), compared against
    # the CROP'S OWN top ~35% (its own sky region, not its full mixed
    # average) -- a genuine sky-to-sky match -- then applied at a much
    # stronger blend now that the target is actually correct.
    world_u8 = np.clip(np.asarray(world_bgr, dtype=np.float32), 0, 255).astype(np.uint8)
    world_rgb = world_u8[:, :, ::-1].astype(np.float32)
    band = 60
    y0 = max(0, wy - band)
    if y0 < wy:
        ambient = world_rgb[y0:wy, wx:wx + ww].reshape(-1, 3).mean(axis=0)
    else:
        ambient = world_rgb[max(0, wy - 1):wy, wx:wx + ww].reshape(-1, 3).mean(axis=0)

    crop_rgb = np.asarray(crop.convert("RGB"), dtype=np.float32)
    sky_rows = max(1, int(wh * 0.35))
    crop_sky_mean = np.maximum(crop_rgb[:sky_rows].reshape(-1, 3).mean(axis=0), 1.0)
    gain = np.clip(ambient / crop_sky_mean, 0.6, 1.8)
    crop_rgb = np.clip(crop_rgb * (0.15 + 0.85 * gain[None, None, :]), 0, 255)
    crop = Image.fromarray(crop_rgb.astype(np.uint8), mode="RGB").convert("RGBA")

    edge = max(16, int(min(ww, wh) * 0.14))
    if direction == "ltr":
        coord = np.tile(np.arange(ww, dtype=np.float32), (wh, 1))
        extent = float(ww)
    elif direction == "ttb":
        coord = np.tile(np.arange(wh, dtype=np.float32).reshape(wh, 1), (1, ww))
        extent = float(wh)
    elif direction == "diag":
        xs = np.arange(ww, dtype=np.float32).reshape(1, ww) * (wh / ww)
        ys = np.arange(wh, dtype=np.float32).reshape(wh, 1)
        coord = xs + ys
        extent = float(coord.max())
    else:
        raise ValueError(direction)
    boundary = p * (extent + 2 * edge) - edge
    alpha = np.clip((boundary - coord) / edge, 0.0, 1.0)

    # r220 (operator, done asking for another guess: "figure it out").
    # Every round back to r196 tried to make a SOLID, hard-edged
    # rectangular photo insert look like it belongs in the real photo --
    # sharpening the crop, matching its color, even trying to erase the
    # real railing to match it pixel-for-pixel (r216-r219: confirmed
    # impossible with any tool available here). All of that was fighting
    # the same losing battle: a fully opaque rectangle of different
    # pixels ALWAYS reads as "a photo taped on," no matter how well it's
    # graded, because real AR glasses don't show solid photographs
    # anyway -- they show a translucent HUD you see the world through.
    # Two structural changes, not another coat of paint:
    #  (1) the shape is now a soft ellipse, not a rectangle -- an organic
    #      vignette with no hard corner or straight edge for the real
    #      scene to have to line up against.
    #  (2) content is genuinely translucent throughout (not just a 90%-
    #      capped edge) -- the real world reads through it everywhere,
    #      the way a heads-up display actually works, so alignment with
    #      real rocks/railings stops being the thing a viewer judges.
    # The reveal still sweeps in `direction` (the existing gesture-timed
    # animation everywhere calls this with), it just now grows inside an
    # ellipse instead of a rectangle.
    yy, xx = np.mgrid[0:wh, 0:ww].astype(np.float32)
    u = (xx - (ww - 1) / 2.0) / (ww / 2.0)
    v = (yy - (wh - 1) / 2.0) / (wh / 2.0)
    radial = np.sqrt(u * u + v * v)
    vignette = np.clip(1.0 - (radial - 0.45) / 0.6, 0.0, 1.0)
    alpha = alpha * vignette

    # Genuinely translucent, not a capped-opacity photo: ~60% at its own
    # most-opaque point, fading to nothing at the vignette's edge -- a
    # projected HUD image, not a solid insert.
    alpha = alpha * 0.60

    crop.putalpha(Image.fromarray((alpha * 255).astype(np.uint8), mode="L"))
    img.alpha_composite(crop, (wx, wy))

    # A soft radial glow (an ellipse, matching the new vignette shape)
    # instead of a rectangular rim -- the same "AR system" identity cue,
    # shaped like the hologram it now actually is.
    rim_alpha = int(50 * min(1.0, p * 2.0))
    if rim_alpha > 0:
        pad = 18
        rim = Image.new("RGBA", (ww + 2 * pad, wh + 2 * pad), (0, 0, 0, 0))
        ImageDraw.Draw(rim).ellipse([pad, pad, pad + ww, pad + wh],
                                     outline=(215, 232, 255, rim_alpha), width=6)
        rim = rim.filter(ImageFilter.GaussianBlur(9))
        img.alpha_composite(rim, (wx - pad, wy - pad))

    # r198's opacity fix (k tracking p almost linearly) was not enough on
    # its own -- ChatGPT's r200 re-check found actual rendered frames at
    # the borrow close (~00:19.4) still showing "the four large corner
    # brackets still occupy the full original window bounds" around a
    # collapsed sliver of content, "two animations that are not
    # spatially coupled." r201: when shrink_brackets=True, the bracket
    # RECTANGLE itself (not just its opacity) is clamped to the actual
    # revealed-content bounds (content + its soft feather edge), so the
    # brackets can never enclose empty space -- scoped to the one call
    # site that actually closes (borrow's own closing sweep).
    bx, by, bwid, bhei = wx, wy, ww, wh
    if shrink_brackets and direction in ("ltr", "ttb"):
        # bound to `boundary` itself -- the exact same value the seam
        # line below is drawn at, so the bracket edge and the seam are
        # always the same position; never leaves a gap of empty bracket
        # beyond the seam the way a full-window rect did.
        if direction == "ltr":
            bwid = max(2, min(ww, int(boundary)))
        else:
            bhei = max(2, min(wh, int(boundary)))
    zone_trace(img, bx + bwid // 2, by + bhei // 2, bwid, bhei, k=min(0.4, p * 1.15))

    if 0.0 < p < 1.0:
        d = ImageDraw.Draw(img, "RGBA")
        if direction == "ltr":
            x = wx + int(boundary)
            if wx <= x <= wx + ww:
                d.line([(x, wy), (x, wy + wh)], fill=ACCENT + (220,), width=4)
        elif direction == "ttb":
            y = wy + int(boundary)
            if wy <= y <= wy + wh:
                d.line([(wx, y), (wx + ww, y)], fill=ACCENT + (220,), width=4)
        else:
            pts = []
            for x in range(wx - 30, wx + ww + 30, 20):
                y = wy + boundary - (x - wx) * (wh / ww)
                if wy - 60 <= y <= wy + wh + 60:
                    pts.append((x, y))
            if len(pts) >= 2:
                d.line(pts, fill=ACCENT + (220,), width=4)
    return img


def primary_label(img, text, k=1.0, y_frac=0.14, font_size=84, accent_bg=True):
    """A big bold idea label (r184's own 72px+ minimum, given headroom
    here). r196 (operator direct note: "that orange text color... it's
    ugly"): text is never colored coral -- ACCENT is reserved entirely
    for geometric elements (rules, brackets, the wipe seam, the anchor
    pulse), never a glyph fill, on any call. accent_bg=True (the hook's
    own "THE WORLD"/"THE LAYER" title toggle) keeps a thin coral rule
    beneath the white text as its one accent touch; accent_bg=False
    (every other beat's label) has no rule."""
    d = ImageDraw.Draw(img, "RGBA")
    f = font("Black", font_size)
    s = text.upper()
    tw = d.textlength(s, font=f)
    x, y = W / 2, H * y_frac
    _soft_patch_scrim(img, x, y, tw / 2 + 70, font_size * 0.62,
                       max_alpha=int(140 * k), blur=max(24, int(font_size * 0.5)))
    a = int(245 * k)
    _halo_text(img, (x, y), s, f, OFFWHITE + (a,), anchor="mm", halo_alpha=int(205 * k), blur=7)
    if accent_bg:
        d = ImageDraw.Draw(img, "RGBA")
        rule_w = tw * 0.4
        ry = y + font_size * 0.44
        d.line([(x - rule_w / 2, ry), (x + rule_w / 2, ry)], fill=ACCENT + (a,), width=4)


def caption(img, t, dur, text, k=None, y_frac=0.88, font_size=52):
    """r184's own 52px+ minimum for explanatory captions, given from the
    start. A soft bottom-edge gradient (real closed-captioning's own
    device) replaces the old hard black bar. r191 (r190's finding):
    plain white type over bright concrete/grass/sky washed out once the
    box was gone -- the gradient's own front-loaded rise (ease_pow) plus
    a stronger local halo and a crisp keyline give the glyphs real
    contrast without bringing back a hard bar."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    f = font("SemiBold", font_size)
    s = text.upper()
    x, y = W / 2, H * y_frac
    _edge_scrim(img, "bottom", band_frac=0.27, max_alpha=int(195 * k), ease_pow=0.5)
    a = int(250 * k)
    _halo_text(img, (x, y), s, f, OFFWHITE + (a,), anchor="mm", halo_alpha=int(190 * k), blur=5,
               keyline_alpha=int(175 * k), keyline_width=2)


def disclosure(img, text="PRODUCT VISUALIZATION", corner="tr", k=1.0, font_size=38):
    """Held continuously by construction (k defaults to 1.0, no fade
    envelope) for the plate's ENTIRE visible interval -- r184's own
    explicit acceptance test. font_size defaults to r184's own 38px
    minimum from the start. Rendered as tracked small caps with a soft
    halo -- reads as an integrated credit line now, not a legal sticker
    stamped in a box. r191 (r190's finding): over pale sky/snow the
    tracked white letters nearly disappeared with only a halo behind
    them -- added a feathered local scrim (a soft patch, not a hard
    box) plus a crisp keyline stroke so contrast holds over any
    background."""
    f = font("Medium", font_size)
    d = ImageDraw.Draw(img, "RGBA")
    tracking = max(2, font_size // 11)
    widths = [d.textlength(ch, font=f) for ch in text]
    tw = (sum(widths) + tracking * (len(text) - 1)) if text else 0
    lh = int(font_size * 1.15)
    margin = 40
    if corner == "tr":
        x, y = W - margin - tw, margin
    elif corner == "tl":
        x, y = margin, margin
    elif corner == "br":
        x, y = W - margin - tw, H - margin - lh
    else:
        x, y = margin, H - margin - lh
    a = int(230 * k)
    _soft_patch_scrim(img, x + tw / 2, y + lh / 2, tw / 2 + 22, lh * 0.65,
                       max_alpha=int(153 * k), blur=max(14, int(font_size * 0.4)))
    _draw_tracked(img, x, y, text, f, OFFWHITE + (a,), tracking=tracking, halo_alpha=int(180 * k), blur=5,
                  keyline_alpha=int(195 * k), keyline_width=2)


def zone_trace(img, cx, cy, w, h, k=1.0, bracket_len_frac=0.22):
    """Four corner brackets (camera-autofocus/AR-bounding-box language)
    marking a recognized zone -- simpler and clearer at speed than a
    hand-drawn perimeter, and deliberately NOT v36's node/path rig,
    which r184 asks this style to avoid entirely."""
    d = ImageDraw.Draw(img, "RGBA")
    x0, y0, x1, y1 = cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2
    seg = int(min(w, h) * bracket_len_frac)
    a = int(235 * k)
    lw = 6
    for (px, py), (sx, sy) in [((x0, y0), (1, 1)), ((x1, y0), (-1, 1)),
                               ((x0, y1), (1, -1)), ((x1, y1), (-1, -1))]:
        d.line([(px, py), (px + sx * seg, py)], fill=ACCENT + (a,), width=lw)
        d.line([(px, py), (px, py + sy * seg)], fill=ACCENT + (a,), width=lw)


def anchor_pulse(img, cx, cy, k=1.0, phase=0.0):
    """A small filled core plus an expanding, fading ring (radar-ping) --
    representing content anchoring to an exact point in the real
    landscape. phase 0..1 loops continuously while shown."""
    d = ImageDraw.Draw(img, "RGBA")
    r0 = 9
    a = int(235 * k)
    d.ellipse([cx - r0, cy - r0, cx + r0, cy + r0], fill=ACCENT + (a,))
    ring_r = int(16 + phase * 46)
    ring_a = int(a * (1.0 - phase))
    if ring_a > 0:
        d.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
                  outline=ACCENT + (ring_a,), width=3)


def loop_word(img, primary, sub, k=1.0, font_size=88, sub_font_size=44):
    """The loop section's own device: real footage plus two or three
    large words at a time -- r184's explicit instruction, "not a system
    diagram." One word pair on screen at once, never four nodes at once
    the way v36's loop did. No box now -- a soft feathered patch and
    blurred-halo text instead, the same treatment as every other label.
    r196: the sub-caption is white now, not coral -- ACCENT is never a
    glyph fill anywhere in this style."""
    d = ImageDraw.Draw(img, "RGBA")
    f = font("Black", font_size)
    fs = font("Medium", sub_font_size)
    y = H * 0.5
    w1 = d.textlength(primary, font=f)
    w2 = d.textlength(sub, font=fs) if sub else 0
    bw = max(w1, w2)
    half_h = font_size * 0.5 + (sub_font_size * 0.55 if sub else 0)
    _soft_patch_scrim(img, W / 2, y, bw / 2 + 70, half_h, max_alpha=int(140 * k), blur=44)
    a = int(245 * k)
    py = y - (sub_font_size * 0.5 + 6) if sub else y
    _halo_text(img, (W / 2, py), primary, f, OFFWHITE + (a,), anchor="mm", halo_alpha=int(195 * k), blur=6)
    if sub:
        _halo_text(img, (W / 2, y + font_size * 0.42 + 8), sub, fs, OFFWHITE + (int(a * 0.85),),
                   anchor="mm", halo_alpha=int(160 * k), blur=4)


def end_card(img, t, dur, line1, line2, k=None):
    """The same true no-fade path v35's r175 round landed on: k defaults
    to fade_k(..., no_out=True) so opacity is held at exactly 1.0 through
    the true final frame, not ~97.5% one frame early. A soft radial
    vignette and a thin coral rule between the two lines replace the old
    hard box -- the wordmark now reads as a considered reveal instead of
    a title card dropped onto a slide. r191 (r190's finding): the coral
    second line lost contrast over the bright overlook -- both lines are
    now white, coral reserved for the separator rule only, with a
    stronger local scrim so the lockup reads confidently through 73.9s."""
    if k is None:
        k = fade_k(t, dur, in_t=0.6, no_out=True)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    f1 = font("Black", 64)
    f2 = font("SemiBold", 34)
    w1 = d.textlength(line1, font=f1)
    w2 = d.textlength(line2, font=f2)
    bw = max(w1, w2)
    x, y = W / 2, H * 0.5
    _soft_patch_scrim(img, x, y, bw / 2 + 90, 100, max_alpha=int(210 * k), blur=56)
    a = int(255 * k)
    _halo_text(img, (x, y - 22), line1, f1, (255, 255, 255, a), anchor="mm", halo_alpha=int(215 * k), blur=7,
               keyline_alpha=int(180 * k), keyline_width=2)
    d = ImageDraw.Draw(img, "RGBA")
    rule_w = min(w1, w2) * 0.5
    ry = y + 9
    d.line([(x - rule_w / 2, ry), (x + rule_w / 2, ry)], fill=ACCENT + (int(220 * k),), width=3)
    _halo_text(img, (x, y + 34), line2, f2, (255, 255, 255, a), anchor="mm", halo_alpha=int(195 * k), blur=5,
               keyline_alpha=int(160 * k), keyline_width=1)
