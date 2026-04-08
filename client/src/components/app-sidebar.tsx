import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  Shield,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transações", url: "/transacoes", icon: ArrowLeftRight },
  { title: "Orçamentos", url: "/orcamentos", icon: PieChart },
  { title: "Metas", url: "/metas", icon: Target },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            aria-label="FinançaLocal"
          >
            <rect
              x="2"
              y="2"
              width="28"
              height="28"
              rx="6"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
            />
            <path
              d="M10 22V14M16 22V10M22 22V16"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-primary"
            />
          </svg>
          <div>
            <h1 className="text-sm font-bold tracking-tight" data-testid="text-app-name">
              FinançaLocal
            </h1>
            <p className="text-[11px] text-muted-foreground leading-none">
              Controle financeiro
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location === "/" || location === ""
                    : location.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          data-testid="badge-lgpd"
        >
          <Shield className="size-3" />
          <span>Dados locais · LGPD</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
