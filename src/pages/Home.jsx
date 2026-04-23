import { BriefcaseBusiness, Handshake, Layers, ShieldCheck, Sparkles, Target } from 'lucide-react'
import ContactsSection from '../components/ContactsSection'
import HeroSection from '../components/HeroSection'
import TestimonialsSection from '../components/TestimonialsSection'
import { useContent } from '../context/ContentContext'

const icons = [
  <Layers key="layers" size={23} />,
  <BriefcaseBusiness key="briefcase" size={23} />,
  <ShieldCheck key="shield" size={23} />,
]

const mission = {
  ru: {
    eyebrow: 'Миссия колледжа',
    title: 'Миссия колледжа ИГУ',
    text: 'Подготовка квалифицированных и конкурентоспособных специалистов среднего звена, удовлетворяющих потребностям реального сектора экономики региона и способных адаптироваться к быстро меняющимся условиям на современном рынке труда.',
    vision: 'Видение',
    visionText:
      'Стать признанным в Кыргызстане колледжем, оказывающим качественные образовательные услуги по подготовке компетентных, конкурентоспособных и высокопрофессиональных специалистов.',
    partnership: 'Партнерство',
    partnershipText:
      'Колледж строит открытое сотрудничество с обществом, родителями, работодателями, государственными и негосударственными структурами.',
    values: 'Ценности',
    valuesTitle: 'Что важно для колледжа',
    list: [
      'Студент - главная ценность. Все, что мы делаем, мы делаем для наших студентов.',
      'Благополучие обучающихся, преподавателей и сотрудников колледжа.',
      'Личностный рост и профессиональное развитие в условиях коллегиальности и доверия.',
      'Справедливость, добросовестность и ответственность при подготовке будущих лидеров общества.',
      'Открытое, честное сотрудничество, мобильность.',
      'Партнерство с общественностью, родителями, государственными и негосударственными структурами.',
      'Высокая репутация колледжа и вклад в развитие образования и общества.',
      'Равный доступ к качественному образованию для людей с ОВЗ и инвалидностью.',
    ],
  },
  ky: {
    eyebrow: 'Колледждин миссиясы',
    title: 'ЫМУ колледжинин миссиясы',
    text: 'Региондун реалдуу экономика секторунун муктаждыктарына жооп берген, эмгек рыногундагы тез өзгөрүп жаткан шарттарга ыңгайлаша алган квалификациялуу жана атаандаштыкка жөндөмдүү орто звенодогу адистерди даярдоо.',
    vision: 'Көз караш',
    visionText:
      'Кыргызстанда сапаттуу билим берүү кызматтарын көрсөтүп, компетенттүү, атаандаштыкка жөндөмдүү жана жогорку кесипкөй адистерди даярдаган таанылган колледж болуу.',
    partnership: 'Өнөктөштүк',
    partnershipText:
      'Колледж коомчулук, ата-энелер, иш берүүчүлөр, мамлекеттик жана мамлекеттик эмес түзүмдөр менен ачык кызматташтыкты өнүктүрөт.',
    values: 'Баалуулуктар',
    valuesTitle: 'Колледж үчүн маанилүү багыттар',
    list: [
      'Студент - башкы баалуулук. Биздин бардык ишибиз студенттер үчүн жасалат.',
      'Билим алуучулардын, окутуучулардын жана кызматкерлердин бакубаттуулугу.',
      'Коллегиалдуулук жана ишеним шартында инсандык өсүүнү жана кесиптик өнүгүүнү колдоо.',
      'Коомдун келечектеги лидерлерин даярдоодо адилеттүүлүк, ак ниеттүүлүк жана жоопкерчилик.',
      'Ачык, чынчыл кызматташтык жана мобилдүүлүк.',
      'Коомчулук, ата-энелер, мамлекеттик жана мамлекеттик эмес түзүмдөр менен өнөктөштүк.',
      'Колледждин жогорку аброю, имиджи жана билим берүү системасы менен коомдун өнүгүшүнө кошкон салымы.',
      'Ден соолугунун мүмкүнчүлүгү чектелген адамдар үчүн сапаттуу билим алууга тең мүмкүнчүлүк түзүү.',
    ],
  },
}

function Home() {
  const { content, language, text } = useContent()
  const highlights = content?.staticPages?.home?.highlights || []
  const missionContent = mission[language]

  return (
    <>
      <HeroSection />

      <section className="section-pad">
        <div className="page-shell">
          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map((item, index) => (
              <div key={text(item.title)} className="glass-panel-strong rounded-[20px] p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  {icons[index % icons.length]}
                </span>
                <h2 className="mt-5 text-xl font-semibold text-text">{text(item.title)}</h2>
                <p className="mt-3 text-sm leading-6 text-muted">{text(item.text)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="page-shell">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="glass-panel rounded-[25px] p-6 sm:p-8">
              <p className="eyebrow">{missionContent.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-text sm:text-4xl">
                {missionContent.title}
              </h2>
              <p className="mt-5 text-sm leading-7 text-muted sm:text-base lg:text-lg lg:leading-8">
                {missionContent.text}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[20px] border border-line/60 bg-panel/55 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/12 text-accent">
                    <Target size={22} />
                  </span>
                  <h3 className="mt-4 text-xl font-semibold text-text">{missionContent.vision}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted md:text-base md:leading-7">
                    {missionContent.visionText}
                  </p>
                </div>

                <div className="rounded-[20px] border border-line/60 bg-panel/55 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/12 text-accent">
                    <Handshake size={22} />
                  </span>
                  <h3 className="mt-4 text-xl font-semibold text-text">{missionContent.partnership}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted md:text-base md:leading-7">
                    {missionContent.partnershipText}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-panel-strong rounded-[25px] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-white shadow-soft">
                  <Sparkles size={22} />
                </span>
                <div>
                  <p className="eyebrow">{missionContent.values}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-text sm:text-3xl">{missionContent.valuesTitle}</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {missionContent.list.map((value) => (
                  <div key={value} className="flex items-start gap-3 rounded-lg bg-panel/45 p-3">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    <p className="text-sm leading-6 text-text md:text-base md:leading-7">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <TestimonialsSection />
      <ContactsSection />
    </>
  )
}

export default Home
