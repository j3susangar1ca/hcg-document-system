"use client";

import React from 'react';
import { 
  LayoutDashboard, 
  Library, 
  FileSearch, 
  BookOpen, 
  FileText, 
  LucideIcon,
  ChevronLeft,
  Bell,
  Settings,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip';
import { useUIStore } from '@/store/useUIStore';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/', badge: 3 },
  { icon: Library, label: 'Biblioteca', href: '/library' },
  { icon: FileSearch, label: 'Búsqueda', href: '/search' },
  { icon: BookOpen, label: 'Documentación', href: '/docs' },
];

export const EnhancedSidebar = () => {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  
  return (
    <TooltipProvider>
      <motion.nav
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="h-screen bg-white/70 backdrop-blur-xl border-r border-gray-200/50 
          flex flex-col py-6 relative z-30"
      >
        {/* Logo */}
        <div className="px-4 mb-8">
          <motion.div 
            className="flex items-center gap-3"
            animate={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
          >
            <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-600 
              rounded-2xl flex items-center justify-center shadow-brand flex-shrink-0">
              <FileText className="text-white" size={24} />
            </div>
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="overflow-hidden"
                >
                  <h1 className="font-bold text-lg text-gray-900 whitespace-nowrap">HCG Docs</h1>
                  <p className="text-xs text-gray-500 whitespace-nowrap">Sistema Inteligente</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                      "hover:bg-gray-100/80 group",
                      isActive && "bg-brand-50 text-brand-600 hover:bg-brand-100"
                    )}
                  >
                    {/* Active Indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 
                          bg-brand-500 rounded-r-full"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    
                    <item.icon 
                      size={22} 
                      className={cn(
                        "transition-colors flex-shrink-0",
                        isActive ? "text-brand-600" : "text-gray-400 group-hover:text-gray-600"
                      )} 
                    />
                    
                    <AnimatePresence mode="wait">
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className={cn(
                            "font-medium text-sm whitespace-nowrap overflow-hidden transition-colors",
                            isActive ? "text-brand-600" : "text-gray-600"
                          )}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    
                    {/* Badge */}
                    {item.badge && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={cn(
                          "flex items-center justify-center min-w-[20px] h-5 px-1.5",
                          "text-xs font-semibold rounded-full",
                          sidebarCollapsed ? "absolute -top-1 -right-1" : "ml-auto",
                          isActive 
                            ? "bg-brand-500 text-white" 
                            : "bg-gray-200 text-gray-600"
                        )}
                      >
                        {item.badge}
                      </motion.span>
                    )}
                  </Link>
                </TooltipTrigger>
                {sidebarCollapsed && (
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="px-3 space-y-2 border-t border-gray-100 pt-4 mt-4">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-100 cursor-pointer text-gray-400 hover:text-blue-600 transition-colors group">
             <Bell size={22} className="flex-shrink-0" />
             {!sidebarCollapsed && <span className="text-sm font-medium text-gray-600">Notificaciones</span>}
             <span className="ml-auto w-2 h-2 bg-red-500 rounded-full" />
          </div>
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-100 cursor-pointer text-gray-400 hover:text-blue-600 transition-colors group">
             <Settings size={22} className="flex-shrink-0" />
             {!sidebarCollapsed && <span className="text-sm font-medium text-gray-600">Configuración</span>}
          </div>
          
          {/* User Avatar */}
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-100 
            cursor-pointer transition-colors mt-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full border-2 border-white shadow-sm overflow-hidden flex items-center justify-center flex-shrink-0">
               <User className="text-gray-500" size={20} />
            </div>
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="font-medium text-sm text-gray-900 truncate">Jesús Langarica</p>
                  <p className="text-xs text-gray-500 truncate">Director</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-10 w-6 h-6 bg-white border border-gray-200 
            rounded-full flex items-center justify-center shadow-sm hover:shadow-md 
            transition-shadow text-gray-400 hover:text-gray-600 z-40"
        >
          <ChevronLeft 
            size={14} 
            className={cn("transition-transform", sidebarCollapsed && "rotate-180")} 
          />
        </button>
      </motion.nav>
    </TooltipProvider>
  );
};
