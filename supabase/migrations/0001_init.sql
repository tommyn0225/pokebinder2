--
-- PostgreSQL database dump
--

\restrict RZGjjct2cOcai2nR56NogBISJclFPb7TDJ6xd45CuIUroihniQJCkhMwiIqDE4L

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: binder_value_history(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.binder_value_history(binder_id_param uuid) RETURNS TABLE(day timestamp with time zone, total_usd numeric)
    LANGUAGE sql STABLE
    AS $$
  select
    date_trunc('day', ps.snapshotted_at) as day,
    sum(ps.price_usd * h.quantity)       as total_usd
  from price_snapshots ps
  join holdings h on ps.holding_id = h.id
  where h.binder_id = binder_id_param
    and ps.price_usd is not null
  group by date_trunc('day', ps.snapshotted_at)
  order by day;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_cache (
    cache_key text NOT NULL,
    response jsonb NOT NULL,
    cached_at timestamp with time zone DEFAULT now() NOT NULL,
    ttl_seconds integer DEFAULT 86400 NOT NULL
);


--
-- Name: binders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.binders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: holdings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holdings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binder_id uuid NOT NULL,
    user_id uuid NOT NULL,
    card_id text NOT NULL,
    game text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    card_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT holdings_quantity_check CHECK ((quantity > 0))
);


--
-- Name: price_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    holding_id uuid NOT NULL,
    card_id text NOT NULL,
    game text NOT NULL,
    price_usd numeric,
    snapshotted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_cache api_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_cache
    ADD CONSTRAINT api_cache_pkey PRIMARY KEY (cache_key);


--
-- Name: binders binders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.binders
    ADD CONSTRAINT binders_pkey PRIMARY KEY (id);


--
-- Name: holdings holdings_binder_id_card_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_binder_id_card_id_key UNIQUE (binder_id, card_id);


--
-- Name: holdings holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_pkey PRIMARY KEY (id);


--
-- Name: price_snapshots price_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_snapshots
    ADD CONSTRAINT price_snapshots_pkey PRIMARY KEY (id);


--
-- Name: price_snapshots_holding_id_snapshotted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX price_snapshots_holding_id_snapshotted_at_idx ON public.price_snapshots USING btree (holding_id, snapshotted_at);


--
-- Name: price_snapshots_holding_id_snapshotted_at_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX price_snapshots_holding_id_snapshotted_at_idx1 ON public.price_snapshots USING btree (holding_id, snapshotted_at);


--
-- Name: binders binders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.binders
    ADD CONSTRAINT binders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: holdings holdings_binder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_binder_id_fkey FOREIGN KEY (binder_id) REFERENCES public.binders(id) ON DELETE CASCADE;


--
-- Name: holdings holdings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holdings
    ADD CONSTRAINT holdings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: price_snapshots price_snapshots_holding_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_snapshots
    ADD CONSTRAINT price_snapshots_holding_id_fkey FOREIGN KEY (holding_id) REFERENCES public.holdings(id) ON DELETE CASCADE;


--
-- Name: binders Users manage own binders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own binders" ON public.binders USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: holdings Users manage own holdings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own holdings" ON public.holdings USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: api_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: binders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.binders ENABLE ROW LEVEL SECURITY;

--
-- Name: holdings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

--
-- Name: price_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict RZGjjct2cOcai2nR56NogBISJclFPb7TDJ6xd45CuIUroihniQJCkhMwiIqDE4L

