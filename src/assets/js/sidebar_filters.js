function isSliderMinMaxed(slider) {
    return slider.get().length >= 2 && slider.options.range.min === slider.get().at(0) && slider.options.range.max === slider.get().at(-1);
}

function isCheckable(element) {
    // For an obscure reason, `<input type="text">` also have a `checked`
    // property so verifying `"checked" in element` is not sufficient.
    return element.type === "radio" || element.type === "checkbox";
}
function getElementValue(element) {
    if (element instanceof HTMLSelectElement) {
       return Array.from(element.options).filter(option => option.selected).map(option => option.value).toString();
    }
    if (element instanceof HTMLInputElement && element.hasAttribute("type")) {
        if (element.type === "checkbox") {
            return Array.from(document.querySelectorAll(`input[name=${element.name}]:checked`)).map(option => option.value).toString();
        } else if (element.type === "text") {
            return element.value;
        }
    }
    if ("noUiSlider" in element) {
        return element.noUiSlider.get().join("-");
    }
    return element.getAttribute("value");
}

function updateUrlSearchParams(element) {
    const urlSearchParams = new URLSearchParams(location.search);
    const value = getElementValue(element);
    const name = element.getAttribute("name");
    // Don't clutter the URL with the default all-encompassing filter value.
    if (value === "" || ("noUiSlider" in element && isSliderMinMaxed(element.noUiSlider))) {
        urlSearchParams.delete(name);
    } else if (isCheckable(element) && urlSearchParams.get(name) === value) {
        // Checking an option adds it to the URL so if the user clicks on an option that was already present in the URL,
        // it means they clicked on a checked input element, in which case we uncheck it and remove it from the URL.
        element.checked = false;
        urlSearchParams.delete(name);
    } else {
        urlSearchParams.set(name, value);
    }
    // Go back to page 1 (aka root of the website) and append the URL search params to the URL.
    const isIteratorEmpty = urlSearchParams.keys().next().done;
    if (isIteratorEmpty) {
        history.pushState({}, "", "{{ '/' | url }}");
    } else {
        history.pushState({}, "", "{{ '/' | url }}" + "?" + urlSearchParams);
    }
    syncSidebarFilters();
    syncPaginationButtons();
}

function flipPages(relativeOffset) {
    const pageNo = Number((location.pathname.match(/page\/([0-9]+)/) || ["page/1", "1"])[1]);
    const newPageNo = pageNo + relativeOffset;
    if (newPageNo <= 1) {
        return "{{ '/' | url }}";
    } else {
        return "{{ '/' | url }}" + "page/" + newPageNo;
    }
}

function showPaginationButton(button, relativeOffset, search) {
    button.href = flipPages(relativeOffset);
    button.search = search;
    button.removeAttribute("hidden");
}

function hidePaginationButton(button) {
    button.setAttribute("hidden", true);
}

function syncPaginationButtons() {
    const showingNResults = $("showing-n-results");
    const previousButton = $("previous-button");
    const nextButton = $("next-button");
    if (showingNResults.innerText === "No results found.") {
        hidePaginationButton(previousButton);
        hidePaginationButton(nextButton);
        return;
    }
    const urlSearchParams = new URLSearchParams(location.search);
    [matchedString, start, end, total] = showingNResults.innerText.match(/Showing ([0-9]+) to ([0-9]+) of ([0-9]+) results found/);
    if (Number(end) < Number(total)) {
        showPaginationButton(nextButton, +1, urlSearchParams);
    } else {
        hidePaginationButton(nextButton);
    }

    if (Number(start) > 1) {
        showPaginationButton(previousButton, -1, urlSearchParams);
    } else if (Number(start) == 0) {
        // start == 0 is a special case that occurs when the user is on a page that's beyond the total amount of pages for this search.
        const postsPerPage = {{ site.paginate }};
        const amountOfPages = Math.ceil(total/postsPerPage);
        const pageNo = Number((location.pathname.match(/page\/([0-9]+)/) || ["page/1", "1"])[1]);
        // Compute the difference between current page number and the number
        // of the last valid page so that clicking the "Previous" button
        // leads to the user to the last valid page.
        showPaginationButton(previousButton, amountOfPages - pageNo, urlSearchParams);
        hidePaginationButton(nextButton);
    } else {
        hidePaginationButton(previousButton);
    }
}

function syncSidebarFilters() {
    const urlSearchParams = new URLSearchParams(location.search);
    for (const [fieldName, fieldValue] of urlSearchParams.entries()) {
        let elements = document.getElementsByName(fieldName);
        for (let element of elements) {
            if ("noUiSlider" in element) {
                const slider = element.noUiSlider;
                const fieldValuesArray = fieldValue.split("-");
                slider.set(fieldValuesArray);
            } else if (element instanceof HTMLSelectElement) {
                if (element.multiple) {
                    const options = element.options;
                    const fieldValuesArray = fieldValue.split(",");
                    for (const option of options) {
                        option.selected = fieldValuesArray.includes(option.value);
                    }
                } else {
                    element.value = fieldValue;
                    if (element.selectedIndex === -1) {
                        alert(`The ${fieldName} "${fieldValue}" is not present in the database!\nReverting to "Any".`);
                        element.selectedIndex = 0;
                        urlSearchParams.delete(fieldName)
                        history.pushState({}, "", "{{ '/' | url }}" + "?" + urlSearchParams);
                        populatePostGrid(getFilteredKeymaps());
                    }
                }
            } else if (element instanceof HTMLInputElement && element.type === "text") {
                element.value = fieldValue;
            } else if (isCheckable(element)) {
                const fieldValuesArray = fieldValue.split(",");
                element.checked = fieldValuesArray.includes(element.value);
            }
        }
    }
}

window.onload = function() {
    /* Resetting the keymap filters in the sidebar because in case
     * of a discrepancy between what the sidebar says and what the URL
     * says, the URL rules.
     */
    resetSidebarFilters(false);
    syncSidebarFilters();
    syncPaginationButtons()
};

function resetSidebarFilters(resetUrl) {
    const keymapFilters = document.getElementsByClassName("keymap-filter");
    for (const keymapFilter of keymapFilters) {
        if (isCheckable(keymapFilter)) {
            keymapFilter.checked = false;
        } else if ("noUiSlider" in keymapFilter) {
            const slider = keymapFilter.noUiSlider;
            slider.set(slider.options.start);
        } else if (keymapFilter instanceof HTMLSelectElement) {
            if (keymapFilter.multiple) {
                const options = keymapFilter.options;
                for (const option of options) {
                    option.selected = false;
                }
            } else {
                keymapFilter.selectedIndex = 0;
            }
        }
    }
    if (resetUrl){
        // Remove filters from the URL
        history.pushState({}, "", location.pathname);
        populatePostGrid(getKeymapsJSON());
    }
}

function updatePostGrid(element) {
    updateUrlSearchParams(element);
    populatePostGrid(getFilteredKeymaps());
}

function toggleFullScreenSidebar() {
    $("sidebar").classList.toggle("hidden");
    $("post-grid-container").classList.toggle("hidden");
    $("menu").classList.add("hidden");
    $("search").classList.add("hidden");
    $("paginator-container").classList.toggle("hidden");
}

$("header-filters-button").addEventListener("click", toggleFullScreenSidebar);
