import { useStore } from '../../store';

export function LayerToggles() {
  const showSeeds = useStore((s) => s.showSeeds);
  const showGenerated = useStore((s) => s.showGenerated);
  const showHull = useStore((s) => s.showHull);
  const showGamut = useStore((s) => s.showGamut);
  const showAxes = useStore((s) => s.showAxes);
  const showClipping = useStore((s) => s.showClipping);
  const morphT = useStore((s) => s.morphT);
  const toggleSeeds = useStore((s) => s.toggleSeeds);
  const toggleGenerated = useStore((s) => s.toggleGenerated);
  const toggleHull = useStore((s) => s.toggleHull);
  const toggleGamut = useStore((s) => s.toggleGamut);
  const toggleAxes = useStore((s) => s.toggleAxes);
  const toggleClipping = useStore((s) => s.toggleClipping);

  const isLifted = morphT > 0;

  const toggles = [
    { label: 'Seeds', checked: showSeeds, toggle: toggleSeeds },
    { label: 'Generated', checked: showGenerated, toggle: toggleGenerated },
    { label: 'Hull', checked: showHull, toggle: toggleHull },
    { label: 'Gamut', checked: showGamut, toggle: toggleGamut },
    { label: 'Axes', checked: showAxes, toggle: toggleAxes },
    { label: 'Clipping', checked: showClipping, toggle: toggleClipping, disabled: isLifted, title: isLifted ? 'Only available in unlifted mode' : undefined },
  ];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-400 font-medium">Layers</span>
      <div className="flex gap-2 flex-wrap">
        {toggles.map(({ label, checked, toggle, disabled, title }) => (
          <label
            key={label}
            className={`flex items-center gap-1 text-xs cursor-pointer ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={title}
          >
            <input type="checkbox" checked={checked} onChange={toggle} className="rounded" disabled={disabled} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
