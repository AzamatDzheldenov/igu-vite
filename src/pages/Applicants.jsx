import { yupResolver } from '@hookform/resolvers/yup'
import { Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'
import { useContent } from '../context/ContentContext'
import axiosInstance from '../utils/axiosInstance'

const copy = {
  ru: {
    eyebrow: 'Абитуриентам',
    title: 'Выберите программу и оставьте заявку',
    text: 'Мы поможем разобраться с документами, сроками и вступительными шагами.',
    name: 'Имя',
    namePlaceholder: 'Анна Иванова',
    phone: 'Телефон',
    email: 'Почта',
    program: 'Программа',
    choose: 'Выберите направление',
    comment: 'Комментарий',
    commentPlaceholder: 'Расскажите, что хотите уточнить',
    submit: 'Отправить заявку',
    submitting: 'Отправляем...',
    success: 'Заявка отправлена. Приемная комиссия свяжется с вами.',
    error: 'Не удалось отправить заявку. Попробуйте еще раз позже.',
    specialties: 'Специальности',
    specialtiesTitle: 'Направления подготовки и сроки обучения',
    specialtiesText:
      'Все программы доступны на базе 9 и 11 класса. Выберите подходящее направление и оставьте заявку в форме выше.',
    qualification: 'Квалификация',
    duration: 'Срок обучения',
    base9: 'на базе 9 класса',
    base11: 'на базе 11 класса',
    duration9: '2 года 10 мес.',
    duration11: '1 год 10 мес.',
    level: 'СПО',
    validation: {
      nameMin: 'Введите имя полностью',
      nameRequired: 'Имя обязательно',
      phone: 'Введите корректный телефон',
      phoneRequired: 'Телефон обязателен',
      email: 'Введите корректную почту',
      emailRequired: 'Почта обязательна',
      program: 'Выберите программу',
      message: 'До 500 символов',
    },
  },
  ky: {
    eyebrow: 'Абитуриенттер үчүн',
    title: 'Багытты тандап, арыз калтырыңыз',
    text: 'Кабыл алуу, документтер жана окуу багыттары боюнча суроолорго жооп беребиз.',
    name: 'Аты-жөнү',
    namePlaceholder: 'Айжан Сыдыкова',
    phone: 'Телефон',
    email: 'Электрондук почта',
    program: 'Багыт',
    choose: 'Багытты тандаңыз',
    comment: 'Комментарий',
    commentPlaceholder: 'Сурооңузду жазыңыз',
    submit: 'Арыз жөнөтүү',
    submitting: 'Жөнөтүлүүдө...',
    success: 'Арыз жөнөтүлдү. Кабыл алуу комиссиясы сиз менен байланышат.',
    error: 'Арызды жөнөтүү мүмкүн болгон жок. Кийинчерээк кайра аракет кылыңыз.',
    specialties: 'Адистиктер',
    specialtiesTitle: 'Даярдоо багыттары жана окуу мөөнөттөрү',
    specialtiesText:
      'Бардык программалар 9-класстын жана 11-класстын базасында жеткиликтүү. Тиешелүү багытты тандап, жогорудагы форма аркылуу арыз калтырыңыз.',
    qualification: 'Квалификация',
    duration: 'Окуу мөөнөтү',
    base9: '9-класстын базасында',
    base11: '11-класстын базасында',
    duration9: '2 жыл 10 ай',
    duration11: '1 жыл 10 ай',
    level: 'Орто кесиптик билим',
    validation: {
      nameMin: 'Аты-жөнүңүздү толук жазыңыз',
      nameRequired: 'Аты-жөнү милдеттүү',
      phone: 'Телефон номерин туура жазыңыз',
      phoneRequired: 'Телефон милдеттүү',
      email: 'Электрондук почтаны туура жазыңыз',
      emailRequired: 'Электрондук почта милдеттүү',
      program: 'Багытты тандаңыз',
      message: '500 белгиге чейин',
    },
  },
}

const specialties = [
  {
    code: '050709',
    title: { ru: 'Преподавание в начальных классах', ky: 'Башталгыч класстарда окутуу' },
    qualification: { ru: 'Учитель начальных классов', ky: 'Башталгыч класстардын мугалими' },
  },
  {
    code: '080106',
    title: { ru: 'Финансы (по отраслям)', ky: 'Финансы (тармактар боюнча)' },
    qualification: { ru: 'Финансист', ky: 'Финансист' },
  },
  {
    code: '080110',
    title: { ru: 'Экономика и бухгалтерский учет (по отраслям)', ky: 'Экономика жана бухгалтердик эсеп (тармактар боюнча)' },
    qualification: { ru: 'Бухгалтер', ky: 'Бухгалтер' },
  },
  {
    code: '100201',
    title: { ru: 'Туризм', ky: 'Туризм' },
    qualification: { ru: 'Специалист по туризму', ky: 'Туризм боюнча адис' },
  },
  {
    code: '140212',
    title: { ru: 'Электроснабжение (по отраслям)', ky: 'Электр менен камсыздоо (тармактар боюнча)' },
    qualification: { ru: 'Техник', ky: 'Техник' },
  },
  {
    code: '190604',
    title: {
      ru: 'Техническое обслуживание и ремонт автомобильного транспорта',
      ky: 'Автомобиль транспортун техникалык тейлөө жана оңдоо',
    },
    qualification: { ru: 'Техник', ky: 'Техник' },
  },
  {
    code: '190701',
    title: {
      ru: 'Организация перевозок и управление на транспорте',
      ky: 'Ташууларды уюштуруу жана транспортто башкаруу',
    },
    qualification: { ru: 'Техник', ky: 'Техник' },
  },
  {
    code: '230109',
    title: {
      ru: 'Программное обеспечение вычислительной техники и автоматизированных систем',
      ky: 'Эсептөө техникасынын жана автоматташтырылган системалардын программалык камсыздоосу',
    },
    qualification: { ru: 'Техник-программист', ky: 'Техник-программист' },
  },
  {
    code: '050303',
    title: { ru: 'Иностранный язык', ky: 'Чет тили' },
    qualification: { ru: 'Учитель английского языка', ky: 'Англис тили мугалими' },
  },
  {
    code: '080108',
    title: { ru: 'Банковское дело', ky: 'Банк иши' },
    qualification: { ru: 'Специалист банковского дела', ky: 'Банк иши боюнча адис' },
  },
]

function createSchema(labels) {
  return yup.object({
    name: yup.string().trim().min(2, labels.validation.nameMin).required(labels.validation.nameRequired),
    phone: yup
      .string()
      .trim()
      .matches(/^[+()\d\s-]{10,20}$/, labels.validation.phone)
      .required(labels.validation.phoneRequired),
    email: yup.string().trim().email(labels.validation.email).required(labels.validation.emailRequired),
    program: yup.string().required(labels.validation.program),
    message: yup.string().trim().max(500, labels.validation.message),
  })
}

function Applicants() {
  const { language, text } = useContent()
  const labels = copy[language]
  const schema = useMemo(() => createSchema(labels), [labels])
  const [status, setStatus] = useState(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      program: '',
      message: '',
    },
  })

  const onSubmit = async (data) => {
    setStatus(null)

    try {
      await axiosInstance.post('/applications', data)
      setStatus({ type: 'success', text: labels.success })
      reset()
    } catch {
      setStatus({ type: 'error', text: labels.error })
    }
  }

  return (
    <section className="section-pad pt-36">
      <div className="page-shell">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="eyebrow">{labels.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-text sm:text-5xl">{labels.title}</h1>
            <p className="mt-5 text-lg leading-8 text-muted">{labels.text}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="glass-panel rounded-[25px] p-5 sm:p-7" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={labels.name}
                error={errors.name?.message}
                input={<input {...register('name')} className="field-input" placeholder={labels.namePlaceholder} />}
              />
              <Field
                label={labels.phone}
                error={errors.phone?.message}
                input={<input {...register('phone')} className="field-input" placeholder="+996 700 000 000" />}
              />
              <Field
                label={labels.email}
                error={errors.email?.message}
                input={<input {...register('email')} className="field-input" placeholder="mail@example.com" type="email" />}
              />
              <Field
                label={labels.program}
                error={errors.program?.message}
                input={
                  <select {...register('program')} className="field-input">
                    <option value="">{labels.choose}</option>
                    {specialties.map((specialty) => (
                      <option key={specialty.code} value={`${specialty.code} ${text(specialty.title)}`}>
                        {specialty.code} {text(specialty.title)}
                      </option>
                    ))}
                  </select>
                }
              />
            </div>

            <div className="mt-5">
              <Field
                label={labels.comment}
                error={errors.message?.message}
                input={
                  <textarea
                    {...register('message')}
                    className="field-input min-h-32 resize-y"
                    placeholder={labels.commentPlaceholder}
                  />
                }
              />
            </div>

            {status && (
              <p
                className={[
                  'mt-5 rounded-lg px-4 py-3 text-sm font-medium',
                  status.type === 'success' ? 'bg-accent/12 text-accent' : 'bg-coral/12 text-coral',
                ].join(' ')}
              >
                {status.text}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft transition duration-300 hover:-translate-y-0.5 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting ? labels.submitting : labels.submit}
              <Send size={17} />
            </button>
          </form>
        </div>

        <section className="mt-12">
          <div className="mb-6 max-w-3xl">
            <p className="eyebrow">{labels.specialties}</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-text sm:text-4xl">{labels.specialtiesTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-muted sm:text-base">{labels.specialtiesText}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {specialties.map((specialty) => (
              <article key={specialty.code} className="glass-panel-strong rounded-[20px] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-accent">{specialty.code}</p>
                    <h3 className="mt-2 text-xl font-semibold leading-7 text-text">{text(specialty.title)}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      {labels.qualification}: <span className="font-semibold text-text">{text(specialty.qualification)}</span>
                    </p>
                  </div>
                  <span className="inline-flex rounded-lg bg-accent/10 px-3 py-2 text-xs font-semibold uppercase text-accent">
                    {labels.level}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 rounded-[18px] border border-line/60 bg-panel/50 p-4">
                  <p className="text-sm font-semibold text-text">{labels.duration}</p>
                  <div className="grid gap-2 text-sm leading-6 text-muted">
                    <p>
                      {labels.base9} - <span className="font-semibold text-text">{labels.duration9}</span>
                    </p>
                    <p>
                      {labels.base11} - <span className="font-semibold text-text">{labels.duration11}</span>
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function Field({ label, input, error }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-text">{label}</span>
      {input}
      {error && <span className="mt-2 block text-xs text-coral">{error}</span>}
    </label>
  )
}

export default Applicants
