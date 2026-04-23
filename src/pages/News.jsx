import { CalendarDays, PlayCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useContent } from '../context/ContentContext'
import { formatDate, ui } from '../utils/i18n'
import { mediaUrl } from '../utils/media'

const pageSize = 6

function News() {
  const { content, language, text } = useContent()
  const [page, setPage] = useState(1)
  const labels = ui[language]
  const news = useMemo(
    () =>
      [...(content?.news || [])].sort(
        (a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt),
      ),
    [content],
  )
  const totalPages = Math.max(1, Math.ceil(news.length / pageSize))
  const visibleNews = news.slice((page - 1) * pageSize, page * pageSize)

  return (
    <section className="section-pad pt-36">
      <div className="page-shell">
        <div className="glass-panel rounded-[25px] p-6 sm:p-8">
          <p className="eyebrow">{labels.news}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-text sm:text-5xl">
            {labels.news}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
            {language === 'ky'
              ? 'Колледждин эң жаңы окуялары, жарыялары жана студенттик демилгелери.'
              : 'Самые свежие события, объявления и студенческие инициативы колледжа.'}
          </p>
        </div>

        {visibleNews.length === 0 ? (
          <div className="glass-panel-strong mt-8 rounded-[20px] p-8 text-center">
            <p className="text-xl font-semibold text-text">{labels.noNews}</p>
            <p className="mt-3 text-sm leading-6 text-muted">{labels.noNewsText}</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5">
            {visibleNews.map((item) => (
              <article key={item.id} className="glass-panel-strong overflow-hidden rounded-[20px]">
                {item.photos?.length > 0 && (
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {item.photos.slice(0, 3).map((photo) => (
                      <img
                        key={photo.url}
                        src={mediaUrl(photo.url)}
                        alt={text(item.title)}
                        className="h-64 w-full object-cover"
                      />
                    ))}
                  </div>
                )}
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                    <span className="inline-flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1 font-semibold text-accent">
                      <CalendarDays size={15} /> {formatDate(item.publishedAt, language)}
                    </span>
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-text">{text(item.title)}</h2>
                  <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-muted">
                    {text(item.text)}
                  </p>

                  {item.videos?.length > 0 && (
                    <div className="mt-5 grid gap-3">
                      {item.videos.map((video) =>
                        video.type === 'external' ? (
                          <ExternalVideoCard key={video.url} video={video} language={language} />
                        ) : (
                          <video key={video.url} controls className="max-h-[520px] w-full rounded-lg">
                            <source src={mediaUrl(video.url)} type={video.mimeType} />
                          </video>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={[
                  'focus-ring h-11 min-w-11 rounded-lg px-4 text-sm font-semibold transition',
                  page === pageNumber
                    ? 'bg-accent text-white'
                    : 'glass-panel-strong text-text hover:text-accent',
                ].join(' ')}
              >
                {pageNumber}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ExternalVideoCard({ video, language }) {
  const coverUrl = mediaUrl(video.coverUrl || getYoutubeCoverUrl(video.url))
  const provider = video.provider || getVideoProvider(video.url)

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noreferrer"
      className="group grid overflow-hidden rounded-lg border border-line/70 bg-panel/60 transition hover:border-accent/40 sm:grid-cols-[220px_1fr]"
    >
      <div className="relative aspect-video bg-accent/12 sm:aspect-auto sm:min-h-36">
        {coverUrl ? (
          <img src={coverUrl} alt={video.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full min-h-44 items-center justify-center bg-accent/10 text-accent sm:min-h-full">
            <PlayCircle size={42} />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white opacity-95 transition group-hover:bg-black/30">
          <PlayCircle size={46} />
        </span>
      </div>
      <div className="flex min-h-36 flex-col justify-center p-4">
        <p className="text-xs font-semibold uppercase text-accent">{providerLabel(provider)}</p>
        <h3 className="mt-2 text-base font-semibold leading-6 text-text sm:text-lg">
          {video.name || (language === 'ky' ? 'Видео' : 'Видео')}
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted">{language === 'ky' ? 'Видеону ачуу' : 'Открыть видео'}</p>
      </div>
    </a>
  )
}

function providerLabel(provider) {
  if (provider === 'youtube') {
    return 'YouTube'
  }

  if (provider === 'instagram') {
    return 'Instagram Reels'
  }

  return 'Видео'
}

function getVideoProvider(url) {
  const normalized = String(url).toLowerCase()

  if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) {
    return 'youtube'
  }

  if (normalized.includes('instagram.com')) {
    return 'instagram'
  }

  return 'external'
}

function getYoutubeCoverUrl(url) {
  const id = getYoutubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''
}

function getYoutubeId(url) {
  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] || ''
    }

    if (parsed.searchParams.get('v')) {
      return parsed.searchParams.get('v')
    }

    const parts = parsed.pathname.split('/').filter(Boolean)
    const embedIndex = parts.findIndex((part) => ['embed', 'shorts'].includes(part))
    return embedIndex >= 0 ? parts[embedIndex + 1] || '' : ''
  } catch {
    return ''
  }
}

export default News
