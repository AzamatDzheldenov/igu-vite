import { Mail, Phone } from 'lucide-react'
import { useContent } from '../context/ContentContext'
import { ui } from '../utils/i18n'

function ContactsSection() {
  const { content, language } = useContent()
  const contacts = content?.contacts || {}
  const labels = ui[language]
  const contactItems = [
    { icon: <Phone size={21} />, label: labels.phone, value: contacts.phone },
    { icon: <Mail size={21} />, label: labels.email, value: contacts.email },
  ]

  return (
    <section className="section-pad">
      <div className="page-shell">
        <div className="glass-panel rounded-[25px] p-6 sm:p-8">
          <p className="eyebrow">{labels.contacts}</p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-semibold text-text sm:text-4xl">
                {language === 'ky' ? 'Байланыш маалыматтары' : 'Контакты колледжа'}
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {contactItems.map(({ icon, label, value }) => (
                <div key={label} className="rounded-[20px] border border-line/60 bg-panel/60 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                      {icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-text">{label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted md:text-base">{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ContactsSection
