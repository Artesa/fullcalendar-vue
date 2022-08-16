import Vue, { PropType, h, defineComponent } from 'vue'
import { Calendar, CalendarOptions } from '@fullcalendar/core'
import { OPTION_IS_COMPLEX } from './options'
import { shallowCopy, mapHash } from './utils'
import { wrapVDomGenerator, createVueContentTypePlugin } from './custom-content-type'

const FullCalendar = defineComponent({

  props: {
    options: Object as PropType<CalendarOptions>
  },

  data: initData, // separate func b/c of type inferencing

  render() {
    return h('div', {
      // when renderId is changed, Vue will trigger a real-DOM async rerender, calling beforeUpdate/updated
      attrs: { 'data-fc-render-id': (this as any).renderId }
    })
  },

  mounted() {
    // store internal data (slotOptions, calendar)
    // https://github.com/vuejs/vue/issues/1988#issuecomment-163013818
    (this as any).slotOptions = mapHash((this as any).$slots, wrapVDomGenerator) // needed for buildOptions
    let calendarOptions = (this as any).buildOptions((this as any).options, (this as any).$.appContext)
    let calendar = new Calendar((this as any).$el as HTMLElement, calendarOptions)
    ;(this as any).calendar = calendar
    calendar.render()
  },

  methods: { // separate funcs b/c of type inferencing
    getApi,
    buildOptions,
  },

  beforeUpdate() {
    (this as any).getApi().resumeRendering() // the watcher handlers paused it
  },

  // @ts-ignore
  beforeUnmount() {
    (this as any).getApi().destroy()
  },

  watch: buildWatchers()
})

export default FullCalendar


function initData() {
  return {
    renderId: 0
  }
}


function buildOptions(
  this: any,
  suppliedOptions: CalendarOptions | undefined,
  appContext: any,
): CalendarOptions {
  suppliedOptions = suppliedOptions || {}
  return {
    ...(this as any).slotOptions,
    ...suppliedOptions, // spread will pull out the values from the options getter functions
    plugins: (suppliedOptions.plugins || []).concat([
      createVueContentTypePlugin(appContext)
    ])
  }
}


function getApi(this: any) {
  return (this as any).calendar
}


type FullCalendarInstance = InstanceType<typeof FullCalendar>


function buildWatchers() {

  let watchers: { [member: string]: any } = {

    // watches changes of ALL options and their nested objects,
    // but this is only a means to be notified of top-level non-complex options changes.
    options: {
      deep: true,
      handler(this: FullCalendarInstance, options: CalendarOptions) {
        let calendar = (this as any).getApi()
        calendar.pauseRendering()

        let calendarOptions = (this as any).buildOptions(options, (this as any).$.appContext)
        calendar.resetOptions(calendarOptions)

        (this as any).renderId++ // will queue a rerender
      }
    }
  }

  for (let complexOptionName in OPTION_IS_COMPLEX) {

    // handlers called when nested objects change
    watchers[`options.${complexOptionName}`] = {
      deep: true,
      handler(this: FullCalendarInstance, val: any) {

        // unfortunately the handler is called with undefined if new props were set, but the complex one wasn't ever set
        if (val !== undefined) {

          let calendar = (this as any).getApi()
          calendar.pauseRendering()
          calendar.resetOptions({
            // the only reason we shallow-copy is to trick FC into knowing there's a nested change.
            // TODO: future versions of FC will more gracefully handle event option-changes that are same-reference.
            [complexOptionName]: shallowCopy(val)
          }, true)

          (this as any).renderId++ // will queue a rerender
        }
      }
    }
  }

  return watchers
}
