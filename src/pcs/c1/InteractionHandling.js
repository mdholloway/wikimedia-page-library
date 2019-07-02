import CollapseTable from '../../transform/CollapseTable'
import Footer from './Footer'
import LazyLoadTransform from '../../transform/LazyLoadTransform'
import ReferenceCollection from '../../transform/ReferenceCollection'

/**
 * Type of actions users can click which may need to be handled by the native side.
 * @type {!Object}
 */
const Actions = {
  LinkClicked: 'link_clicked',
  ImageClicked: 'image_clicked',
  ReferenceClicked: 'reference_clicked',
  EditSection: 'edit_section',
  AddTitleDescription: 'add_title_description',

  /* Footer related actions: */
  FooterItemSelected: 'footer_item_selected',
  SaveOtherPage: 'save_other_page',
  ReadMoreTitlesRetrieved: 'read_more_titles_retrieved',
  ViewLicense: 'view_license',
  ViewInBrowser: 'view_in_browser',
}

let interactionHandler

/**
 * Model of an Interaction.
 */
class Interaction {
  /**
   * @param {!string} action the type of action
   * @param {?Object.<any>} data details of the action
   */
  constructor(action, data) {
    this.action = action
    this.data = data
  }
}

/**
 * Type of items users can click which we may need to handle.
 * @type {!Object}
 */
const ItemType = {
  unknown: 0,
  link: 1,
  image: 2,
  imagePlaceholder: 3,
  reference: 4
}

/**
 * Model of clicked item.
 * Reminder: separate `target` and `href` properties
 * needed to handle non-anchor targets such as images.
 */
class ClickedItem {
  /**
   * @param {!EventTarget} target event target
   * @param {!string} href
   */
  constructor(target, href) {
    this.target = target
    this.href = href
  }

  /**
   * Determines type of item based on its properties.
   * @return {!ItemType} Type of the item
   */
  type() {
    if (ReferenceCollection.isCitation(this.href)) {
      return ItemType.reference
    } else if (this.target.tagName === 'IMG'
      && (this.target.classList.contains(LazyLoadTransform.CLASSES.IMAGE_LOADED_CLASS)
          || this.target.classList.contains(LazyLoadTransform.CLASSES.IMAGE_LOADING_CLASS))
      && (this.target.closest('figure') || this.target.closest('figure-inline'))
    ) {
      return ItemType.image
    } else if (this.target.tagName === 'SPAN'
      && this.target.classList.contains(LazyLoadTransform.CLASSES.PLACEHOLDER_CLASS)
      && (this.target.closest('figure') || this.target.closest('figure-inline'))
    ) {
      return ItemType.imagePlaceholder
    } else if (this.href) {
      return ItemType.link
    }
    return ItemType.unknown
  }
}

/**
 * Posts a message to native land using the interaction handler.
 * @param {Interaction} interaction the interaction data
 * @return {void}
 */
const postMessage = interaction => {
  interactionHandler(interaction)
}

/**
 * Posts message for a link click.
 * @param {!string} href url
 * @return {void}
 */
const postMessageForLinkWithHref = href => {
  if (href[0] === '#') {
    CollapseTable.expandCollapsedTableIfItContainsElement(
      document.getElementById(href.substring(1)))
  }
  postMessage(new Interaction(Actions.LinkClicked, { href }))
}

/**
 * Posts message for an image click.
 * @param {!Element} target an image element
 * @return {void}
 */
const postMessageForImageWithTarget = target => {
  postMessage(new Interaction(Actions.ImageClicked, {
    src: target.getAttribute('src'),
    // Image should be fetched by time it is tapped,
    // so naturalWidth and height should be available.
    width: target.naturalWidth,
    height: target.naturalHeight,
    'data-file-width': target.getAttribute('data-file-width'),
    'data-file-height': target.getAttribute('data-file-height')
  }))
}

/**
 * Posts a message for a lazy load image placeholder click.
 * @param {!Element} innerPlaceholderSpan
 * @return {void}
 */
const postMessageForImagePlaceholderWithTarget = innerPlaceholderSpan => {
  const outerSpan = innerPlaceholderSpan.parentElement
  postMessage(new Interaction(Actions.ImageClicked, {
    src: outerSpan.getAttribute('data-src'),
    width: outerSpan.getAttribute('data-width'),
    height: outerSpan.getAttribute('data-height'),
    'data-file-width': outerSpan.getAttribute('data-data-file-width'),
    'data-file-height': outerSpan.getAttribute('data-data-file-height')
  }))
}

/**
 * Posts a message for a reference click.
 * @param {!Element} target an anchor element
 * @return {void}
 */
const postMessageForReferenceWithTarget = target => {
  const nearbyReferences = ReferenceCollection.collectNearbyReferences(document, target)
  postMessage(new Interaction(Actions.ReferenceClicked, nearbyReferences))
}

/**
 * Post messages to native land for respective click types.
 * @param  {!ClickedItem} item the item which was clicked on
 * @return {boolean} `true` if a message was sent, otherwise `false`
 */
const postMessageForClickedItem = item => {
  switch (item.type()) {
  case ItemType.link:
    postMessageForLinkWithHref(item.href)
    break
  case ItemType.image:
    postMessageForImageWithTarget(item.target)
    break
  case ItemType.imagePlaceholder:
    postMessageForImagePlaceholderWithTarget(item.target)
    break
  case ItemType.reference:
    postMessageForReferenceWithTarget(item.target)
    break
  default:
    return false
  }
  return true
}

/**
 * Handler for the click event. Posts messages across the JS bridge to native land.
 * @param  {Event} event the event being handled
 * @return {void}
 */
const handleClickEvent = event => {
  const target = event.target
  if (!target) {
    return
  }
  // Find anchor for non-anchor targets - like images.
  const anchorForTarget = target.closest('A')
  if (!anchorForTarget) {
    return
  }

  // Handle edit links.
  if (anchorForTarget.getAttribute('data-action') === 'edit_section') {
    postMessage(new Interaction(Actions.EditSection,
      { sectionId: anchorForTarget.getAttribute('data-id') }))
    return
  }

  // Handle add title description link.
  if (anchorForTarget.getAttribute('data-action') === 'add_title_description') {
    postMessage(new Interaction(Actions.AddTitleDescription))
    return
  }

  const href = anchorForTarget.getAttribute('href')
  if (!href) {
    return
  }
  postMessageForClickedItem(new ClickedItem(target, href))
}

/**
 * @param {!string} itemType type of footer menu item
 * @param {!map} payload menu item payload
 * @return {void}
 */
const footerItemSelected = (itemType, payload) => {
  postMessage(new Interaction(Actions.FooterItemSelected, { itemType, payload }))
}

/**
 * @param {!string} title page title
 * @return {void}
 */
const saveOtherPage = title => {
  postMessage(new Interaction(Actions.SaveOtherPage, { title }))
}

/**
 * @param {!list<string>} titles list of 'Read more' page titles
 * @return {void}
 */
const titlesRetrieved = titles => {
  postMessage(new Interaction(Actions.ReadMoreTitlesRetrieved, { titles }))
}

/**
 * @return {void}
 */
const viewLicense = () => {
  postMessage(new Interaction(Actions.ViewLicense))
}

/**
 * @return {void}
 */
const viewInBrowser = () => {
  postMessage(new Interaction(Actions.ViewInBrowser))
}

/**
 * Sets the interaction handler function.
 * @param {~Function} myHandlerFunction a platform specific bridge function.
 * On iOS consider using something like:
 *   (interaction) => { window.webkit.messageHandlers.interaction.postMessage(interaction) }
 * On Android consider using something like:
 *   (interaction) => { window.InteractionWebInterface.post(interaction) }
 * To test in a browser consider using something like:
 *   (interaction) => { console.log(JSON.stringify(interaction)) }
 * @return {void}
 */
const setInteractionHandler = myHandlerFunction => {
  interactionHandler = myHandlerFunction

  Footer._connectHandlers({
    footerItemSelected,
    saveOtherPage,
    titlesRetrieved,
    viewLicense,
    viewInBrowser
  })

  // Associate our custom click handler logic with the document `click` event.
  document.addEventListener('click', event => {
    event.preventDefault()
    handleClickEvent(event)
  }, false)
}

export default {
  Actions,
  setInteractionHandler
}