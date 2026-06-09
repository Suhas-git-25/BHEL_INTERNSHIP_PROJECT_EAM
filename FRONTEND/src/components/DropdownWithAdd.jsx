import { useState, useEffect } from "react";

export default function DropdownWithAdd({
  label,
  value,
  onChange,
  onAddNew,
  options = [],
  placeholder = "Select or type...",
  loading = false,
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localOptions, setLocalOptions] = useState(options);
  const [filteredOptions, setFilteredOptions] = useState(options);
  const typedValue = String(value || "");
  const cleanTypedValue = typedValue.trim();

  useEffect(() => {
    setLocalOptions((current) => uniqueOptions([...current, ...options]));
  }, [options]);

  useEffect(() => {
    setFilteredOptions(filterOptions(localOptions, typedValue));
  }, [localOptions, typedValue]);

  const handleSelect = (option) => {
    const clean = String(option || "").trim();
    if (!clean) return;
    onChange(clean);
    setIsOpen(false);
  };

  const handleAdd = async () => {
    if (!cleanTypedValue || exists) return;
    setLocalOptions((current) => uniqueOptions([...current, cleanTypedValue]));
    if (onAddNew) {
      await onAddNew(cleanTypedValue);
    }
    onChange(cleanTypedValue);
    setIsOpen(false);
  };

  const handleInputChange = (e) => {
    const inputValue = e.target.value;
    onChange(inputValue);
    setIsOpen(true);
  };

  const exists = cleanTypedValue && localOptions.some((opt) => sameOption(opt, cleanTypedValue));
  const canAdd = Boolean(cleanTypedValue && !exists);

  return (
    <div className="relative">
      <label className="text-sm text-slate-300">
        {label}
        {required && <span className="text-rose-400 ml-1">*</span>}
      </label>
      
      <div className="relative mt-1">
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            disabled={loading}
          />
          {canAdd ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAdd}
              className="shrink-0 rounded-md border border-sky-700 bg-sky-950/70 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              Add
            </button>
          ) : null}
        </div>
        
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 shadow-lg">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  className="block w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
                >
                  {option}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-500">No matches</div>
            )}
          </div>
        )}
      </div>
      
      <p className="mt-1 text-xs text-slate-500">Type to search. Use Add to save a new option.</p>
    </div>
  );
}

function sameOption(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function uniqueOptions(values) {
  const seen = new Set();
  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b));
}

function filterOptions(values, inputValue) {
  const query = String(inputValue || "").trim().toLowerCase();
  if (!query) return values;
  return values.filter((opt) => opt.toLowerCase().includes(query));
}
