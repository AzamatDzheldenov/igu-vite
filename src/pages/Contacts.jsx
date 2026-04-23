import ContactsSection from '../components/ContactsSection'
import { useContent } from '../context/ContentContext'
import { ui } from '../utils/i18n'

function Contacts() {
  const { language } = useContent()
  const labels = ui[language]

  return (
    <>
      <section className="pt-36">
        <div className="page-shell">
          <div className="glass-panel rounded-[25px] p-6 sm:p-8">
            <p className="eyebrow">{labels.contacts}</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-text sm:text-5xl">
              {language === 'ky' ? 'Колледж менен байланыш' : 'Контакты колледжа'}
            </h1>
          </div>
        </div>
      </section>
      <ContactsSection />
    </>
  )
}

export default Contacts