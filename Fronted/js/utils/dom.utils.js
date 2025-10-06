export class DOMUtils {
    static createElement(tag, className, innerHTML) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    }

    static render(selector, html) {
        const element = document.querySelector(selector);
        if (element) {
            element.innerHTML = html;
        }
    }

    static show(selector) {
        const element = document.querySelector(selector);
        if (element) element.style.display = 'block';
    }

    static hide(selector) {
        const element = document.querySelector(selector);
        if (element) element.style.display = 'none';
    }

    static addClass(selector, className) {
        const element = document.querySelector(selector);
        if (element) element.classList.add(className);
    }

    static removeClass(selector, className) {
        const element = document.querySelector(selector);
        if (element) element.classList.remove(className);
    }
}