import { EnvironmentInjector } from '@angular/core';
import { createCustomElement } from '@angular/elements';
import {
  TasksBlockComponent,
  SubtasksBlockComponent,
  AgendaBlockComponent,
} from '@nabdchainsystem/canvas';

let registered = false;

export function registerCustomElements(environmentInjector: EnvironmentInjector) {
  if (registered) {
    return;
  }
  const registry: Array<[string, any]> = [
    ['ncs-tasks-block', TasksBlockComponent],
    ['ncs-subtasks-block', SubtasksBlockComponent],
    ['ncs-agenda-block', AgendaBlockComponent],
  ];
  for (const [tag, component] of registry) {
    if (!customElements.get(tag)) {
      const element = createCustomElement(component, { injector: environmentInjector });
      customElements.define(tag, element);
    }
  }
  registered = true;
}
