import type { BlogOutline } from "../utils/outline";

interface OutlineDisplayProps {
  outline: BlogOutline;
}

export default function OutlineDisplay({ outline }: OutlineDisplayProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-slate-900">Hook</p>
        <p className="mt-1 text-sm text-slate-700">{outline.hook}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">30-Second Answer</p>
        <p className="mt-1 text-sm text-slate-700">{outline.quickAnswer}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">Topic Breakdown</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {outline.topicBreakdown.map((section, index) => (
            <li key={index}>{section}</li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">Example</p>
        <p className="mt-1 text-sm text-slate-700">{outline.example}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">FAQs</p>
        <ol className="mt-1 space-y-2">
          {outline.faqs.map((faq, index) => (
            <li key={index} className="text-sm text-slate-700">
              <p className="font-medium text-slate-800">
                {index + 1}. {faq.question}
              </p>
              <p className="mt-0.5 text-slate-600">{faq.answer}</p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">Takeaways</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {outline.takeaways.map((takeaway, index) => (
            <li key={index}>{takeaway}</li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">Call to Action</p>
        <p className="mt-1 text-sm text-slate-700">{outline.cta}</p>
      </div>
    </div>
  );
}
