# Lighthouse Checklist

Run Lighthouse after deployment from Chrome DevTools:

1. Open the deployed site.
2. Open DevTools.
3. Go to Lighthouse.
4. Test mobile and desktop.

## Performance

- LCP should ideally be under 2.5s.
- CLS should be under 0.1.
- Initial JS should stay split into route chunks.
- Hero image should load AVIF/WebP where supported.

If LCP is high:

- Confirm `home-hero-bg.avif` or `.webp` is used.
- Check server compression and cache headers.
- Check network latency and TTFB.

If CLS is high:

- Check images have stable dimensions.
- Check header/menu does not shift content.
- Check late-loading fonts.

## Accessibility

- Keyboard navigation works.
- Focus states are visible.
- Forms show errors clearly.
- Color contrast is readable in light and dark themes.

## Best Practices

- HTTPS is enabled.
- No console security errors.
- Uploads return `X-Content-Type-Options: nosniff`.
- CSP does not block required fonts/images/API calls.

If CSP reports errors:

- Read the blocked directive and source.
- Add only the exact source required.
- Do not disable CSP globally.

## SEO

- Title and description are present.
- Canonical URL points to the production domain.
- Open Graph preview has title, description and image.
- JSON-LD parses without syntax errors.

## After Deploy

- `/` opens.
- `/admin-login` opens.
- `/api/content` works on VPS.
- Admin login works on VPS.
- Applications list, filters and CSV export work for admin.
- SMM cannot access applications or CSV export.

