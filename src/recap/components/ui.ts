import type { ComponentType, ReactNode } from 'react'
import * as UI from '../../components/ui'

// De gedeelde Dash-componenten zijn JS: TypeScript ziet daar elke prop als verplicht.
// Hier één keer losjes getypt, zodat Recap ze gewoon kan gebruiken.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Loose = ComponentType<{ children?: ReactNode; [prop: string]: any }>

export const Card = UI.Card as unknown as Loose
export const CardHeader = UI.CardHeader as unknown as Loose
export const KpiTile = UI.KpiTile as unknown as Loose
export const FilterTabs = UI.FilterTabs as unknown as Loose
export const EmptyState = UI.EmptyState as unknown as Loose
