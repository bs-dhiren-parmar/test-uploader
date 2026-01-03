import type { StylesConfig, GroupBase } from 'react-select';

/**
 * Shared react-select styles for consistent UI across the application
 */
export const reactSelectStyles = <
    Option,
    IsMulti extends boolean = false,
    Group extends GroupBase<Option> = GroupBase<Option>
>(): StylesConfig<Option, IsMulti, Group> => ({
    control: (base, state) => ({
        ...base,
        minHeight: '38px',
        borderColor: state.isFocused ? '#5D57F4' : '#e5e7eb',
        borderRadius: '6px',
        boxShadow: state.isFocused ? '0 0 0 1px #5D57F4' : 'none',
        '&:hover': { 
            borderColor: '#5D57F4' 
        },
    }),
    placeholder: (base) => ({
        ...base,
        color: '#9ca3af',
        fontSize: '0.875rem',
    }),
    singleValue: (base) => ({
        ...base,
        color: '#374151',
        fontSize: '0.875rem',
    }),
    input: (base) => ({
        ...base,
        color: '#374151',
        fontSize: '0.875rem',
    }),
    menu: (base) => ({
        ...base,
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 9999,
    }),
    menuList: (base) => ({
        ...base,
        padding: '4px',
    }),
    menuPortal: (base) => ({
        ...base,
        zIndex: 9999,
    }),
    option: (base, state) => ({
        ...base,
        fontSize: '0.875rem',
        padding: '8px 12px',
        borderRadius: '4px',
        cursor: 'pointer',
        backgroundColor: state.isSelected 
            ? '#5D57F4' 
            : state.isFocused 
                ? 'rgba(93, 87, 244, 0.1)' 
                : 'transparent',
        color: state.isSelected ? 'white' : '#374151',
        '&:active': {
            backgroundColor: state.isSelected ? '#5D57F4' : 'rgba(93, 87, 244, 0.2)',
        },
    }),
    indicatorSeparator: (base) => ({
        ...base,
        backgroundColor: '#e5e7eb',
    }),
    dropdownIndicator: (base, state) => ({
        ...base,
        color: state.isFocused ? '#5D57F4' : '#9ca3af',
        '&:hover': {
            color: '#5D57F4',
        },
    }),
    clearIndicator: (base) => ({
        ...base,
        color: '#9ca3af',
        '&:hover': {
            color: '#ef4444',
        },
    }),
    loadingIndicator: (base) => ({
        ...base,
        color: '#5D57F4',
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: 'rgba(93, 87, 244, 0.1)',
        borderRadius: '4px',
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: '#5D57F4',
        fontSize: '0.8125rem',
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#5D57F4',
        '&:hover': {
            backgroundColor: 'rgba(93, 87, 244, 0.2)',
            color: '#5D57F4',
        },
    }),
});

export default reactSelectStyles;

