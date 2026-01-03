import React, { useCallback } from 'react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange?: (itemsPerPage: number) => void;
    itemsPerPageOptions?: number[];
}

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    itemsPerPageOptions = [10, 25, 50, 100],
}) => {
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const getPageNumbers = (): (number | string)[] => {
        const pages: (number | string)[] = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    // Memoized handlers for JSX props
    const handlePreviousPage = useCallback(() => {
        onPageChange(currentPage - 1);
    }, [currentPage, onPageChange]);

    const handleNextPage = useCallback(() => {
        onPageChange(currentPage + 1);
    }, [currentPage, onPageChange]);

    const handleItemsPerPageChangeWrapper = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        if (onItemsPerPageChange) {
            onItemsPerPageChange(Number(e.target.value));
        }
    }, [onItemsPerPageChange]);

    const handlePageButtonClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const page = e.currentTarget.dataset.page;
        if (page) {
            onPageChange(Number(page));
        }
    }, [onPageChange]);

    if (totalItems === 0) {
        return null;
    }

    return (
        <div className="pagination-container">
            <div className="pagination-info">
                Showing {startItem}-{endItem} of {totalItems} items
            </div>

            <div className="pagination-controls">
                <button
                    className="pagination-btn pagination-nav"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                >
                    ‹
                </button>

                {getPageNumbers().map((page, index) => (
                    typeof page === 'number' ? (
                        <button
                            key={page}
                            data-page={page}
                            className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                            onClick={handlePageButtonClick}
                        >
                            {page}
                        </button>
                    ) : (
                        <span key={`ellipsis-${index}`} className="pagination-ellipsis">{page}</span>
                    )
                ))}

                <button
                    className="pagination-btn pagination-nav"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                >
                    ›
                </button>
            </div>

            {onItemsPerPageChange && (
                <div className="pagination-per-page">
                    <span>Per page:</span>
                    <select
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChangeWrapper}
                        className="pagination-select"
                    >
                        {itemsPerPageOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
};

export default Pagination;

