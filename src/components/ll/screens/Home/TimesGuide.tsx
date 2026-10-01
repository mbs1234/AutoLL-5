import { memo, use } from 'react';

import { Experience } from '@/api/ll';
import { Land } from '@/api/resort';
import Button from '@/components/Button';
import LandLine from '@/components/LandLine';
import Screen from '@/components/Screen';
import Tab from '@/components/Tab';
import { Time } from '@/components/Time';
import ContextStrip from '@/components/ll/ContextStrip';
import DasPartiesContext from '@/contexts/DasPartiesContext';
import ExperiencesContext from '@/contexts/ExperiencesContext';
import NavContext from '@/contexts/NavContext';
import ThemeContext from '@/contexts/ThemeContext';

import DasPartyList from '../DasPartyList';
import { HomeTabProps } from '../Home';
import RefreshButton from '../RefreshButton';
import Legend, { Symbol } from './Legend';
import ParkSelect from './ParkSelect';

export default function TimesGuide({ ref }: HomeTabProps) {
  const { goTo } = use(NavContext);
  const { experiences, refreshExperiences, loaderElem } =
    use(ExperiencesContext);
  const parties = use(DasPartiesContext);

  return (
    <Tab
      title="Times"
      buttons={
        <>
          {parties.length > 0 && (
            <Button
              title="Disability Access Service"
              onClick={() => goTo(<DasPartyList parties={parties} />)}
            >
              DAS
            </Button>
          )}
          <ParkSelect />
          <RefreshButton name="Times" onClick={refreshExperiences} />
        </>
      }
      subhead={<ContextStrip interactive />}
      ref={ref}
    >
      <Experiences experiences={experiences} />
      {loaderElem}
    </Tab>
  );
}

const Experiences = memo(function Experiences({
  experiences,
}: {
  experiences: Experience[];
}) {
  const { goTo } = use(NavContext);
  const showExpInfo = (exp: Experience) => goTo(<ExperienceInfo exp={exp} />);

  const expsByLand = new Map<Land, Record<Experience['type'], Experience[]>>();
  experiences
    .filter(
      exp =>
        exp.standby.available ||
        exp.standby.unavailableReason === 'TEMPORARILY_DOWN' ||
        exp.individual?.available ||
        exp.virtualQueue
    )
    .sort(
      (a, b) =>
        a.land.sort - b.land.sort ||
        showTimeNum(a) - showTimeNum(b) ||
        a.name.localeCompare(b.name)
    )
    .forEach(exp => {
      if (!expsByLand.has(exp.land)) {
        expsByLand.set(exp.land, { A: [], E: [], C: [], H: [], P: [] });
      }
      expsByLand.get(exp.land)?.[exp.type]?.push(exp);
    });

  return (
    <>
      {[...expsByLand].map(([land, expsByType]) => (
        <div key={land.name}>
          {/* The land as a quiet label in its own colour, and its lists as one
              card, as the tip board draws its tiers. */}
          <h2
            className={`mt-4 mb-2 px-1 ${land.theme.text} text-[13px] font-bold tracking-wide uppercase`}
          >
            {land.name}
          </h2>
          <div className="overflow-hidden rounded-[18px] border border-gray-300 bg-white">
            {(
              [
                ['A', 'Attractions'],
                ['E', 'Entertainment'],
                ['H', 'Holiday Entertainment'],
                ['C', 'Characters'],
                ['P', 'Party Entertainment'],
              ] as const
            ).map(([type, title]) => (
              <ExperienceList
                title={title}
                land={land}
                experiences={expsByType[type]}
                onInfoClick={showExpInfo}
                key={type}
              />
            ))}
          </div>
        </div>
      ))}
      {experiences.length > 0 && (
        <>
          <Legend title="Symbols">
            <Symbol sym="–" def="No posted wait/show time" />
            <Symbol
              sym={<span className="text-xs text-red-700">Down</span>}
              def="Temporarily down"
            />
            <Symbol sym="VQ" def="Virtual queue" />
          </Legend>
          <p className="text-sm text-center">
            <span className={`${use(ThemeContext).text} font-bold`}>
              Popular attractions
            </span>{' '}
            are shown in bold
          </p>
        </>
      )}
    </>
  );
});

const showTimeNum = (exp: Experience) => +(exp.showTimes?.[0] ?? 86400);

/**
 * A wait or a show time, the thing this tab is read for, in a soft box in the
 * display face with digits that keep their width, as the tip board draws its
 * standby times.
 */
const BOX =
  'inline-block min-w-10 rounded-lg border border-gray-300 bg-gray-50 px-2 font-display text-base leading-6 font-semibold tabular-nums text-ink uppercase [&_span_span]:text-xs';

function ExperienceList({
  title,
  land,
  experiences,
  onInfoClick,
}: {
  title: string;
  land: Land;
  experiences: Experience[];
  onInfoClick: (experience: Experience) => void;
}) {
  if (experiences.length === 0) return null;
  return (
    <div
      className="border-t border-gray-200 first:border-t-0"
      data-testid={`${land.name}-${title}`}
    >
      <h3 className="mt-0 px-3 pt-2.5 pb-0.5 text-[11px] font-bold tracking-wide text-gray-500 uppercase">
        {title}
      </h3>
      <table className="w-full leading-snug">
        <tbody className="divide-y divide-gray-200">
          {experiences.map(exp => (
            <tr key={exp.id}>
              <td
                className={`${
                  exp.showTimes ? 'min-w-[5.625rem]' : 'min-w-[3.25rem]'
                } py-1 pr-1 pl-3 text-center whitespace-nowrap`}
              >
                {exp.showTimes?.[0] ? (
                  exp.showTimes.length > 1 ? (
                    <button
                      onClick={() => onInfoClick(exp)}
                      className={`${BOX} underline decoration-gray-400 underline-offset-2`}
                    >
                      <Time time={exp.showTimes[0]} />
                    </button>
                  ) : (
                    <span className={BOX}>
                      <Time time={exp.showTimes[0]} />
                    </span>
                  )
                ) : exp.standby.available ? (
                  <span className={BOX}>{exp.standby.waitTime ?? '–'}</span>
                ) : exp.virtualQueue &&
                  exp.standby.unavailableReason === 'NOT_STANDBY_ENABLED' ? (
                  <span className={BOX}>VQ</span>
                ) : (
                  <span
                    className="inline-block rounded-lg border border-red-200 bg-red-100 px-2 text-xs leading-6 font-semibold text-red-700"
                    title="Temporarily down"
                  >
                    Down
                  </span>
                )}
              </td>
              <td className="w-full py-1 pr-3 pl-2">
                <div className="flex items-center gap-x-2">
                  <div
                    className={`flex-1 ${
                      exp.highlight ? `font-bold ${land.theme.text}` : ''
                    }`}
                  >
                    {exp.name}
                  </div>
                  {exp?.individual && (
                    <div
                      className={`${land.theme.text} text-xs leading-tight font-semibold text-center uppercase`}
                    >
                      <div>
                        <abbr title="Lightning Lane">LL</abbr>
                        {': ' + exp.individual.displayPrice}
                      </div>
                      {exp.individual.nextAvailableTime && (
                        <div>
                          <Time time={exp.individual.nextAvailableTime} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ExperienceInfo = ({ exp }: { exp: Experience }) => (
  <Screen title="Experience Info">
    <h2>{exp.name}</h2>
    <LandLine land={exp.land} />
    <h3>Upcoming {exp.type === 'C' ? 'Appearances' : 'Shows'}</h3>
    <ul className="mt-2 divide-y divide-gray-200 overflow-hidden rounded-[18px] border border-gray-300 bg-white px-3 [&>li]:py-2.5">
      {exp.showTimes?.map(time => (
        <li key={+time}>
          <Time
            time={time}
            className="font-display text-lg font-semibold tabular-nums text-ink [&_span_span]:text-sm"
          />
        </li>
      ))}
    </ul>
  </Screen>
);
