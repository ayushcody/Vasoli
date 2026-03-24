"use client"

import Link from "next/link"
import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Filter,
  FolderOpen,
  Inbox,
  Search,
  Sparkles,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import ImageCard from "@/components/ui/image-card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Marquee from "@/components/ui/marquee"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Toaster as NeoToaster } from "@/components/ui/sonner"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const chartData = [
  { month: "Jan", inflow: 52000, spend: 36000 },
  { month: "Feb", inflow: 48000, spend: 33000 },
  { month: "Mar", inflow: 61000, spend: 41000 },
  { month: "Apr", inflow: 58000, spend: 39500 },
  { month: "May", inflow: 67000, spend: 43000 },
  { month: "Jun", inflow: 72000, spend: 45200 },
]

const chartConfig = {
  inflow: {
    label: "Inflow",
    color: "#FD712C",
  },
  spend: {
    label: "Spend",
    color: "#1A1A1A",
  },
} satisfies ChartConfig

const commandItems = [
  { label: "Review cashflow", shortcut: "G C" },
  { label: "Create budget", shortcut: "G B" },
  { label: "Import statement", shortcut: "G I" },
]

const comboboxOptions = [
  { value: "ops", label: "Ops" },
  { value: "marketing", label: "Marketing" },
  { value: "savings", label: "Savings" },
  { value: "travel", label: "Travel" },
]

const tableRows = [
  { merchant: "Rent", category: "Fixed", amount: "₹28,000", status: "Paid" },
  { merchant: "Blinkit", category: "Food", amount: "₹2,460", status: "Review" },
  { merchant: "Spotify", category: "Subscriptions", amount: "₹119", status: "Paid" },
  { merchant: "Flight", category: "Travel", amount: "₹8,999", status: "Planned" },
]

const marqueeItems = [
  "Thick borders",
  "Offset shadows",
  "Bold spacing",
  "Registry-installed UI",
  "No handwritten primitives",
]

const formSchema = z.object({
  email: z.string().email("Enter a valid email"),
  plan: z.enum(["weekly", "monthly"]),
  alerts: z.boolean(),
})

function DemoCard({
  title,
  description,
  className,
  children,
}: {
  title: string
  description: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn("bg-background/90", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ShowcaseHeader() {
  return (
    <section className="space-y-6 border-b-2 border-border pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <Badge>Neobrutalism Registry</Badge>
        <Badge variant="neutral">App Router</Badge>
        <Badge variant="neutral">shadcn/ui</Badge>
      </div>
      <div className="max-w-4xl space-y-4">
        <h1 className="text-4xl font-heading sm:text-5xl">UI Kit Showcase</h1>
        <p className="max-w-2xl text-base font-base text-foreground/80">
          Registry-backed neobrutal components installed into
          <code className="mx-1 rounded-base border-2 border-border bg-main px-2 py-1 text-main-foreground">
            @/components/ui
          </code>
          plus docs-style compositions for Combobox, Date Picker, and Data Table.
        </p>
      </div>
      <Alert>
        <Sparkles />
        <AlertTitle>Registry note</AlertTitle>
        <AlertDescription>
          <p>
            `Combobox`, `Date Picker`, and `Data Table` do not ship as standalone
            neobrutalism registry JSON items, so this page demonstrates them using the
            installed primitives from the neobrutal docs patterns.
          </p>
        </AlertDescription>
      </Alert>
    </section>
  )
}

export default function UIKitPage() {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date(2026, 2, 24))
  const [datePickerDate, setDatePickerDate] = React.useState<Date | undefined>(new Date(2026, 2, 27))
  const [sliderValue, setSliderValue] = React.useState([64])
  const [progressValue] = React.useState(72)
  const [comboboxOpen, setComboboxOpen] = React.useState(false)
  const [comboboxValue, setComboboxValue] = React.useState("ops")
  const [commandOpen, setCommandOpen] = React.useState(false)
  const [isCollapsibleOpen, setIsCollapsibleOpen] = React.useState(false)
  const [filter, setFilter] = React.useState("")

  const filteredRows = React.useMemo(() => {
    const search = filter.trim().toLowerCase()
    if (!search) {
      return tableRows
    }

    return tableRows.filter((row) =>
      [row.merchant, row.category, row.status].some((value) =>
        value.toLowerCase().includes(search),
      ),
    )
  }, [filter])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "ayush@vasoli.app",
      plan: "weekly",
      alerts: true,
    },
  })

  const selectedComboboxLabel =
    comboboxOptions.find((option) => option.value === comboboxValue)?.label ?? "Choose a budget"

  function onSubmit(values: z.infer<typeof formSchema>) {
    toast.success("Form submitted", {
      description: `${values.email} will receive ${values.plan} summaries.`,
    })
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-paper-1">
        <NeoToaster position="top-right" />
        <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <ShowcaseHeader />

          <div className="grid gap-6 xl:grid-cols-3">
            <DemoCard
              title="Core Building Blocks"
              description="Button, badge, breadcrumb, avatar, alert, card, image card, and skeleton."
              className="xl:col-span-2"
            >
              <div className="space-y-6">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href="/">Home</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/app/dashboard">Finance</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>UI Kit</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>

                <div className="flex flex-wrap gap-3">
                  <Button>Primary</Button>
                  <Button variant="neutral">Neutral</Button>
                  <Button variant="reverse">Reverse</Button>
                  <Badge>Default badge</Badge>
                  <Badge variant="neutral">Neutral badge</Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="noShadow">
                        <Bell />
                        Tooltip
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Budget reminders stay loud here.</TooltipContent>
                  </Tooltip>
                </div>

                <div className="grid gap-4 md:grid-cols-[auto_1fr]">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-14">
                      <AvatarImage src="https://i.pravatar.cc/120?img=12" alt="Ayush" />
                      <AvatarFallback>AY</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="font-heading text-lg">Ayush Chougula</p>
                      <p className="font-base text-sm text-foreground/70">
                        Builder mode with a thick-border dashboard.
                      </p>
                    </div>
                  </div>
                  <Alert>
                    <TrendingUp />
                    <AlertTitle>Monthly runway looks stable</AlertTitle>
                    <AlertDescription>
                      <p>Income is pacing 17% ahead of spend this quarter.</p>
                    </AlertDescription>
                  </Alert>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle>Neo card</CardTitle>
                      <CardDescription>Accent-heavy surfaces with offset shadow.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="font-base text-sm">Spend buffer</p>
                      <p className="font-heading text-3xl">₹46,800</p>
                    </CardContent>
                    <CardFooter>
                      <Button size="sm">Inspect</Button>
                    </CardFooter>
                  </Card>
                  <ImageCard
                    imageUrl="https://images.unsplash.com/photo-1518186233392-c232efbf2373?auto=format&fit=crop&w=800&q=80"
                    caption="Image Card from the registry."
                    className="w-full"
                  />
                  <div className="space-y-3 rounded-base border-2 border-border bg-background p-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                </div>
              </div>
            </DemoCard>

            <DemoCard
              title="Feedback"
              description="Progress, slider, and Sonner stay consistent with the same brutal theme."
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-base">
                    <span>Import completion</span>
                    <span>{progressValue}%</span>
                  </div>
                  <Progress value={progressValue} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-base">
                    <span>Safety buffer</span>
                    <span>{sliderValue[0]}%</span>
                  </div>
                  <Slider value={sliderValue} onValueChange={setSliderValue} max={100} step={1} />
                </div>

                <Button
                  className="w-full"
                  onClick={() =>
                    toast("Toast from Sonner", {
                      description: "Styled with the installed neobrutal Sonner wrapper.",
                      action: {
                        label: "View",
                        onClick: () => undefined,
                      },
                    })
                  }
                >
                  Trigger Toast
                </Button>
              </div>
            </DemoCard>

            <DemoCard
              title="Inputs And Selection"
              description="Input, textarea, checkbox, radio group, switch, select, and input OTP."
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email-field">Email</Label>
                  <Input id="email-field" placeholder="founder@vasoli.app" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes-field">Notes</Label>
                  <Textarea
                    id="notes-field"
                    placeholder="Write a spending rule that should never feel silent."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Checkbox id="review-transactions" defaultChecked />
                      <Label htmlFor="review-transactions">Review imported transactions</Label>
                    </div>
                    <div className="flex items-center justify-between rounded-base border-2 border-border bg-secondary-background px-3 py-2">
                      <Label htmlFor="live-switch">Live alerts</Label>
                      <Switch id="live-switch" defaultChecked />
                    </div>
                  </div>
                  <RadioGroup defaultValue="cashflow" className="gap-3">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem id="cashflow-view" value="cashflow" />
                      <Label htmlFor="cashflow-view">Cashflow</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem id="goals-view" value="goals" />
                      <Label htmlFor="goals-view">Goals</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Select defaultValue="monthly">
                    <SelectTrigger>
                      <SelectValue placeholder="Pick cadence" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily digest</SelectItem>
                      <SelectItem value="weekly">Weekly review</SelectItem>
                      <SelectItem value="monthly">Monthly close</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="space-y-2">
                    <Label>Input OTP</Label>
                    <InputOTP maxLength={4} defaultValue="2403">
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
              </div>
            </DemoCard>

            <DemoCard
              title="Calendar And Date Picker"
              description="Standalone calendar plus the docs-style date picker composition."
            >
              <div className="space-y-4">
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} />

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="neutral" className="w-full justify-between">
                      <span>
                        {datePickerDate
                          ? datePickerDate.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Pick a date"}
                      </span>
                      <CalendarDays />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={datePickerDate}
                      onSelect={setDatePickerDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </DemoCard>

            <DemoCard
              title="Combobox"
              description="Docs-style composition using Popover + Command because neobrutalism does not expose a separate combobox registry item."
            >
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button variant="neutral" role="combobox" className="w-full justify-between">
                    <span>{selectedComboboxLabel}</span>
                    <ChevronDown />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0">
                  <Command>
                    <CommandInput placeholder="Search budget..." />
                    <CommandList>
                      <CommandEmpty>No budget found.</CommandEmpty>
                      <CommandGroup heading="Budgets">
                        {comboboxOptions.map((option) => (
                          <CommandItem
                            key={option.value}
                            onSelect={() => {
                              setComboboxValue(option.value)
                              setComboboxOpen(false)
                            }}
                          >
                            <Wallet />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </DemoCard>

            <DemoCard
              title="Form"
              description="Registry form primitives wired with react-hook-form and zod."
              className="xl:col-span-2"
            >
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="ops@vasoli.app" {...field} />
                        </FormControl>
                        <FormDescription>Where weekly summaries should land.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="plan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cadence</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="alerts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-base border-2 border-border bg-secondary-background px-4 py-3 lg:col-span-3">
                        <div className="space-y-1">
                          <FormLabel>Threshold alerts</FormLabel>
                          <FormDescription>Ping me when spend crosses the limit.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="lg:col-span-3">
                    <Button type="submit">Submit form</Button>
                  </div>
                </form>
              </Form>
            </DemoCard>

            <DemoCard
              title="Accordion And Collapsible"
              description="Disclosure patterns with the same border-shadow treatment."
            >
              <div className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="rule-1">
                    <AccordionTrigger>How should alerts feel?</AccordionTrigger>
                    <AccordionContent>
                      Loud enough to notice, compact enough to skim.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="rule-2">
                    <AccordionTrigger>Why neobrutal here?</AccordionTrigger>
                    <AccordionContent>
                      Heavy borders and offset shadows make dense finance UI easier to scan.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
                  <div className="flex items-center justify-between rounded-base border-2 border-border bg-secondary-background px-4 py-3">
                    <p className="font-heading">Quick memo</p>
                    <CollapsibleTrigger asChild>
                      <Button variant="noShadow" size="sm">
                        {isCollapsibleOpen ? "Hide" : "Show"}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="rounded-b-base border-x-2 border-b-2 border-border bg-background px-4 py-3 font-base">
                    The collapsible registry item is intentionally minimal, so the page composes the
                    surface around it instead of replacing the primitive.
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </DemoCard>

            <DemoCard
              title="Command"
              description="Inline command plus the modal command dialog."
            >
              <div className="space-y-4">
                <Command className="h-[220px]">
                  <CommandInput placeholder="Search actions..." />
                  <CommandList>
                    <CommandEmpty>No matching command.</CommandEmpty>
                    <CommandGroup heading="Actions">
                      {commandItems.map((item) => (
                        <CommandItem key={item.label}>
                          <Search />
                          {item.label}
                          <CommandShortcut>{item.shortcut}</CommandShortcut>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>

                <Button variant="neutral" onClick={() => setCommandOpen(true)}>
                  Open command dialog
                </Button>
                <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
                  <CommandInput placeholder="Search showcase..." />
                  <CommandList>
                    <CommandGroup heading="Sections">
                      <CommandItem onSelect={() => setCommandOpen(false)}>
                        <FolderOpen />
                        Navigation
                      </CommandItem>
                      <CommandItem onSelect={() => setCommandOpen(false)}>
                        <CalendarDays />
                        Date picker
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </CommandDialog>
              </div>
            </DemoCard>

            <DemoCard
              title="Menus And Hover States"
              description="Dropdown menu, context menu, menubar, hover card, and navigation menu."
              className="xl:col-span-2"
            >
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="neutral">Dropdown Menu</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Duplicate dashboard</DropdownMenuItem>
                      <DropdownMenuItem>Share report</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="noShadow">Hover Card</Button>
                    </HoverCardTrigger>
                    <HoverCardContent>
                      Brutal surfaces work well for compact metadata like owner, cadence, and spend cap.
                    </HoverCardContent>
                  </HoverCard>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="noShadow">Popover</Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <p className="font-base text-sm">
                        Popovers keep inline actions visible without collapsing the page.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>

                <ContextMenu>
                  <ContextMenuTrigger className="flex min-h-32 items-center justify-center rounded-base border-2 border-dashed border-border bg-secondary-background p-4 text-center font-base">
                    Right click this tile for the context menu demo.
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuLabel>Actions</ContextMenuLabel>
                    <ContextMenuSeparator />
                    <ContextMenuItem>Rename budget</ContextMenuItem>
                    <ContextMenuItem>Archive category</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>

                <Menubar>
                  <MenubarMenu>
                    <MenubarTrigger>File</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem>Import CSV</MenubarItem>
                      <MenubarItem>Export report</MenubarItem>
                      <MenubarSeparator />
                      <MenubarItem>Close</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                  <MenubarMenu>
                    <MenubarTrigger>View</MenubarTrigger>
                    <MenubarContent>
                      <MenubarItem>Dashboard</MenubarItem>
                      <MenubarItem>Transactions</MenubarItem>
                    </MenubarContent>
                  </MenubarMenu>
                </Menubar>

                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger>Collections</NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid gap-3 p-4 md:w-[320px]">
                          <li>
                            <NavigationMenuLink asChild>
                              <Link
                                href="/app/dashboard"
                                className="block rounded-base border-2 border-border p-3"
                              >
                                <p className="font-heading">Dashboard</p>
                                <p className="font-base text-sm text-foreground/70">
                                  High-level runway and health score.
                                </p>
                              </Link>
                            </NavigationMenuLink>
                          </li>
                          <li>
                            <NavigationMenuLink asChild>
                              <Link
                                href="/app/transactions"
                                className="block rounded-base border-2 border-border p-3"
                              >
                                <p className="font-heading">Transactions</p>
                                <p className="font-base text-sm text-foreground/70">
                                  Detailed audit trail for imports.
                                </p>
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              </div>
            </DemoCard>

            <DemoCard
              title="Dialog Stack"
              description="Dialog, alert dialog, drawer, and sheet."
            >
              <div className="flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>Dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Share dashboard</DialogTitle>
                      <DialogDescription>
                        Send a private link to the monthly finance snapshot.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="share-email">Email</Label>
                      <Input id="share-email" defaultValue="team@vasoli.app" />
                    </div>
                    <DialogFooter>
                      <Button variant="neutral">Cancel</Button>
                      <Button>Share</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="neutral">Alert Dialog</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archive the sandbox ledger?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This only affects the demo ledger, not the business screens.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction>Archive</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Drawer>
                  <DrawerTrigger asChild>
                    <Button variant="reverse">Drawer</Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <div className="mx-auto w-full max-w-sm">
                      <DrawerHeader>
                        <DrawerTitle>Mobile action tray</DrawerTitle>
                        <DrawerDescription>
                          A compact drawer for fast finance actions.
                        </DrawerDescription>
                      </DrawerHeader>
                      <DrawerFooter className="grid grid-cols-2">
                        <Button variant="noShadow">Create goal</Button>
                        <DrawerClose asChild>
                          <Button variant="neutral">Close</Button>
                        </DrawerClose>
                      </DrawerFooter>
                    </div>
                  </DrawerContent>
                </Drawer>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="noShadow">Sheet</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Audit trail</SheetTitle>
                      <SheetDescription>
                        Use a sheet when context should stay visible behind the panel.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-3 py-4">
                      <div className="rounded-base border-2 border-border bg-secondary-background p-3 font-base">
                        CSV imported successfully
                      </div>
                      <div className="rounded-base border-2 border-border bg-secondary-background p-3 font-base">
                        3 merchants normalized
                      </div>
                    </div>
                    <SheetFooter>
                      <Button variant="neutral">Dismiss</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
            </DemoCard>

            <DemoCard
              title="Tabs, Table, And Data Table"
              description="Registry table primitives plus a docs-style data table composition."
              className="xl:col-span-2"
            >
              <div className="space-y-5">
                <Tabs defaultValue="table">
                  <TabsList>
                    <TabsTrigger value="table">Table</TabsTrigger>
                    <TabsTrigger value="data-table">Data Table</TabsTrigger>
                  </TabsList>

                  <TabsContent value="table" className="pt-4">
                    <Table>
                      <TableCaption>Quarterly finance snapshot.</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Main account</TableCell>
                          <TableCell>Healthy</TableCell>
                          <TableCell className="text-right">₹2,42,000</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Expense wallet</TableCell>
                          <TableCell>Watch</TableCell>
                          <TableCell className="text-right">₹18,400</TableCell>
                        </TableRow>
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell>Total</TableCell>
                          <TableCell />
                          <TableCell className="text-right">₹2,60,400</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TabsContent>

                  <TabsContent value="data-table" className="space-y-4 pt-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative min-w-[260px] flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                        <Input
                          className="pl-9"
                          placeholder="Filter merchants or categories"
                          value={filter}
                          onChange={(event) => setFilter(event.target.value)}
                        />
                      </div>
                      <Button variant="neutral">
                        <Filter />
                        Filters
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Merchant</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((row) => (
                          <TableRow key={row.merchant}>
                            <TableCell>{row.merchant}</TableCell>
                            <TableCell>{row.category}</TableCell>
                            <TableCell>
                              <Badge variant={row.status === "Paid" ? "default" : "neutral"}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{row.amount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
              </div>
            </DemoCard>

            <DemoCard
              title="Pagination"
              description="Compact page controls."
            >
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#pagination" />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#p1" isActive>
                      1
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#p2">2</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#pagination" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </DemoCard>

            <DemoCard
              title="Chart"
              description="Recharts wrapped with the neobrutal chart container."
            >
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="inflow" fill="var(--color-inflow)" radius={0} />
                  <Bar dataKey="spend" fill="var(--color-spend)" radius={0} />
                </BarChart>
              </ChartContainer>
            </DemoCard>

            <DemoCard
              title="Carousel"
              description="Embla-powered slides using installed card primitives."
            >
              <Carousel className="mx-12">
                <CarouselContent>
                  {[
                    { title: "Import", value: "7 files" },
                    { title: "Budgets", value: "4 active" },
                    { title: "Goals", value: "2 funded" },
                  ].map((slide) => (
                    <CarouselItem key={slide.title} className="md:basis-1/2">
                      <Card className="h-full">
                        <CardHeader>
                          <CardTitle>{slide.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-heading">{slide.value}</p>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </DemoCard>

            <DemoCard
              title="Scroll Area And Resizable"
              description="Scrollable notes and split-pane workspace."
              className="xl:col-span-2"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <ScrollArea className="h-64 rounded-base border-2 border-border bg-secondary-background p-4">
                  <div className="space-y-4 font-base">
                    {Array.from({ length: 8 }, (_, index) => (
                      <div key={index} className="rounded-base border-2 border-border bg-background p-3">
                        Reconciliation note {index + 1}: keep imports visible, corrections fast,
                        and actions unmistakable.
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="h-64 overflow-hidden rounded-base border-2 border-border bg-background">
                  <ResizablePanelGroup orientation="horizontal">
                    <ResizablePanel defaultSize={55}>
                      <div className="flex h-full items-center justify-center bg-main font-heading text-main-foreground">
                        Left panel
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={45}>
                      <div className="flex h-full items-center justify-center bg-secondary-background font-heading">
                        Right panel
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </div>
              </div>
            </DemoCard>

            <DemoCard
              title="Sidebar"
              description="Standalone non-fixed sidebar composition for the showcase."
              className="xl:col-span-3"
            >
              <div className="overflow-hidden rounded-base border-2 border-border">
                <SidebarProvider defaultOpen>
                  <div className="flex min-h-[320px]">
                    <Sidebar collapsible="none" className="w-72">
                      <SidebarHeader>
                        <div className="flex items-center gap-3 rounded-base border-2 border-border bg-main px-3 py-3">
                          <Wallet />
                          <div>
                            <p className="font-heading">Vasoli UI Kit</p>
                            <p className="text-sm font-base text-main-foreground/70">
                              Showcase sandbox
                            </p>
                          </div>
                        </div>
                      </SidebarHeader>
                      <SidebarContent>
                        <SidebarGroup>
                          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                          <SidebarMenu>
                            <SidebarMenuItem>
                              <SidebarMenuButton>
                                <Inbox />
                                <span>Overview</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                              <SidebarMenuButton isActive>
                                <CreditCard />
                                <span>Transactions</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                              <SidebarMenuButton>
                                <UserRound />
                                <span>Goals</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          </SidebarMenu>
                        </SidebarGroup>
                      </SidebarContent>
                      <SidebarFooter>
                        <div className="rounded-base border-2 border-border bg-secondary-background p-3 font-base">
                          3 alerts need review
                        </div>
                      </SidebarFooter>
                    </Sidebar>
                    <SidebarInset className="flex items-center justify-center p-6">
                      <div className="max-w-xl space-y-3">
                        <p className="font-heading text-2xl">Inset content</p>
                        <p className="font-base text-foreground/75">
                          This keeps the sidebar registry primitives visible without reworking the
                          existing business shell.
                        </p>
                      </div>
                    </SidebarInset>
                  </div>
                </SidebarProvider>
              </div>
            </DemoCard>

            <DemoCard
              title="Marquee"
              description="Continuous motion with explicit neobrutal borders."
              className="xl:col-span-3"
            >
              <Marquee items={marqueeItems} />
            </DemoCard>

            <DemoCard
              title="Area Chart Variant"
              description="A second chart sample to show the reusable container."
              className="xl:col-span-3"
            >
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="inflow"
                    type="monotone"
                    fill="var(--color-inflow)"
                    fillOpacity={0.32}
                    stroke="var(--color-inflow)"
                  />
                  <Area
                    dataKey="spend"
                    type="monotone"
                    fill="var(--color-spend)"
                    fillOpacity={0.18}
                    stroke="var(--color-spend)"
                  />
                </AreaChart>
              </ChartContainer>
            </DemoCard>
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
