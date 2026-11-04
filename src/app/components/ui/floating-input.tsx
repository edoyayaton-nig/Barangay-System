import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  isPassword?: boolean;
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, icon, error, isPassword, type = 'text', id, className = '', required, value, placeholder, ...props }, ref) => {
    const inputId = id || `float-input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const [showPass, setShowPass] = useState(false);
    const resolvedType = isPassword ? (showPass ? 'text' : 'password') : type;
    const isDate = type === 'date';
    const hasValue = value !== undefined && value !== null && value !== '';

    return (
      <div className="relative w-full group">
        {icon && (
          <div className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-[#006B66] transition-colors pointer-events-none z-10">
            {icon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          value={value}
          placeholder=" "
          required={required}
          className={`peer block w-full rounded-xl border bg-white text-base sm:text-xs text-slate-900 transition-all shadow-xs outline-none
            ${icon ? 'pl-9 pr-3' : 'px-3'}
            ${isPassword ? 'pr-9' : ''}
            h-[42px]
            ${
              error
                ? 'border-[#B42318] focus:border-[#B42318] focus:ring-2 focus:ring-[#B42318]/20'
                : 'border-[#D5E2E8] focus:border-[#006B66] focus:ring-2 focus:ring-[#006B66]/20'
            }
            ${className}`}
          {...props}
        />

        <label
          htmlFor={inputId}
          className={`absolute pointer-events-none transition-all duration-150 ease-out origin-top-left z-10
            ${icon && !isDate ? 'left-9 peer-focus:left-2.5' : 'left-2.5'}
            ${
              hasValue || isDate
                ? '-top-2 left-2.5 text-[10px] font-semibold text-slate-600 bg-white px-1 rounded-sm'
                : 'top-2.5 text-xs font-normal text-slate-400 bg-transparent'
            }
            peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-placeholder-shown:bg-transparent
            ${isDate || hasValue ? '!top-[-8px] !left-2.5 !text-[10px] !font-semibold !bg-white !px-1' : ''}
            peer-focus:!-top-2 peer-focus:!left-2.5 peer-focus:!text-[10px] peer-focus:!font-semibold peer-focus:!bg-white peer-focus:!px-1
            ${
              error
                ? 'text-[#B42318] peer-focus:text-[#B42318]'
                : 'peer-focus:text-[#006B66]'
            }`}
        >
          {label} {required && <span className="text-[#B42318] font-bold ml-0.5">*</span>}
        </label>

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer z-10"
            tabIndex={-1}
            aria-label={showPass ? 'Hide password' : 'Show password'}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}

        {error && <p className="mt-1 text-[10px] text-[#B42318] pl-1">{error}</p>}
      </div>
    );
  }
);
FloatingInput.displayName = 'FloatingInput';

export interface FloatingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const FloatingTextarea = forwardRef<HTMLTextAreaElement, FloatingTextareaProps>(
  ({ label, error, id, className = '', required, value, rows = 3, placeholder, ...props }, ref) => {
    const inputId = id || `float-area-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const hasValue = value !== undefined && value !== null && value !== '';

    return (
      <div className="relative w-full group">
        <textarea
          ref={ref}
          id={inputId}
          value={value}
          placeholder=" "
          required={required}
          rows={rows}
          className={`peer block w-full rounded-xl border bg-white text-base sm:text-xs text-slate-900 transition-all shadow-xs outline-none px-3 pt-2.5 pb-2
            ${
              error
                ? 'border-[#B42318] focus:border-[#B42318] focus:ring-2 focus:ring-[#B42318]/20'
                : 'border-[#D5E2E8] focus:border-[#006B66] focus:ring-2 focus:ring-[#006B66]/20'
            }
            ${className}`}
          {...props}
        />

        <label
          htmlFor={inputId}
          className={`absolute pointer-events-none transition-all duration-150 ease-out origin-top-left z-10 left-2.5
            ${
              hasValue
                ? '-top-2 text-[10px] font-semibold text-slate-600 bg-white px-1'
                : 'top-2.5 text-xs font-normal text-slate-400 bg-transparent'
            }
            peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-xs peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-placeholder-shown:bg-transparent
            ${hasValue ? '!top-[-8px] !text-[10px] !font-semibold !bg-white !px-1' : ''}
            peer-focus:!-top-2 peer-focus:!text-[10px] peer-focus:!font-semibold peer-focus:!bg-white peer-focus:!px-1
            ${
              error
                ? 'text-[#B42318] peer-focus:text-[#B42318]'
                : 'peer-focus:text-[#006B66]'
            }`}
        >
          {label} {required && <span className="text-[#B42318] font-bold ml-0.5">*</span>}
        </label>

        {error && <p className="mt-1 text-[10px] text-[#B42318] pl-1">{error}</p>}
      </div>
    );
  }
);
FloatingTextarea.displayName = 'FloatingTextarea';

export interface FloatingSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const FloatingSelect = forwardRef<HTMLSelectElement, FloatingSelectProps>(
  ({ label, icon, error, id, options, className = '', required, value, children, ...props }, ref) => {
    const selectId = id || `float-select-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const hasValue = value !== undefined && value !== null && value !== '';

    return (
      <div className="relative w-full group">
        {icon && (
          <div className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-[#006B66] transition-colors pointer-events-none z-10">
            {icon}
          </div>
        )}

        <select
          ref={ref}
          id={selectId}
          value={value}
          required={required}
          className={`peer block w-full rounded-xl border bg-white text-base sm:text-xs text-slate-900 transition-all shadow-xs outline-none appearance-none
            ${icon ? 'pl-9 pr-8' : 'px-3 pr-8'}
            h-[42px] cursor-pointer
            ${
              error
                ? 'border-[#B42318] focus:border-[#B42318] focus:ring-2 focus:ring-[#B42318]/20'
                : 'border-[#D5E2E8] focus:border-[#006B66] focus:ring-2 focus:ring-[#006B66]/20'
            }
            ${className}`}
          {...props}
        >
          <option value="" disabled hidden>
            {/* Clean empty placeholder */}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>

        {/* Custom Chevron */}
        <div className="absolute right-3 top-3 pointer-events-none text-slate-400 z-10">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>

        <label
          htmlFor={selectId}
          className={`absolute pointer-events-none transition-all duration-150 ease-out origin-top-left z-10
            ${icon && !hasValue ? 'left-9' : 'left-2.5'}
            ${
              hasValue
                ? '-top-2 left-2.5 text-[10px] font-semibold text-slate-600 bg-white px-1 rounded-sm'
                : 'top-2.5 text-xs font-normal text-slate-400 bg-transparent'
            }
            peer-focus:!-top-2 peer-focus:!left-2.5 peer-focus:!text-[10px] peer-focus:!font-semibold peer-focus:!bg-white peer-focus:!px-1
            ${
              error
                ? 'text-[#B42318] peer-focus:text-[#B42318]'
                : 'peer-focus:text-[#006B66]'
            }`}
        >
          {label} {required && <span className="text-[#B42318] font-bold ml-0.5">*</span>}
        </label>

        {error && <p className="mt-1 text-[10px] text-[#B42318] pl-1">{error}</p>}
      </div>
    );
  }
);
FloatingSelect.displayName = 'FloatingSelect';
